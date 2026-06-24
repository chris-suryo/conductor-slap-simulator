/**
 * Orchestrates a full simulation run.
 *
 * A single fixed-step loop holds BOTH the mechanical state (per-phase lateral
 * oscillators) and the protection state (recloser FSM). Each tick:
 *   1. compute the live faulted-pair separation/clearance from the mechanical state,
 *   2. advance the protection FSM (it may trip, open, reclose, re-strike, or lock out),
 *   3. apply the magnetic force during energized faults (force weakens as 1/separation),
 *   4. integrate the oscillators,
 *   5. record a frame + summary statistics.
 *
 * Educational visualization — not a certified design or relay-setting tool.
 */
import type {
  FaultType,
  FinalState,
  Phase,
  ProtectionState,
  Scenario,
  SimulationFrame,
  SimulationResult,
  UpstreamFaultEvent,
} from './types'
import {
  D_MIN_M,
  DEFAULT_INDUCED_FAULT_A,
  EDU_FORCE_GAIN,
  FAULT_START_MS,
  NOMINAL_LOAD_CURRENT_A,
  REDUCED_LOAD_CURRENT_A,
  SIM_DT_MS,
  SIM_HORIZON_MS,
  TERMINAL_TAIL_MS,
  UNFAULTED_COUPLING,
  UNFAULTED_PHASE_CURRENT_A,
} from './constants'
import { ftToM, mToFt } from './units'
import { getConductor } from './conductorCatalog'
import { computeMechParams, stepOscillator, type OscillatorState } from './motionSolver'
import { forcePerLengthNPerM } from './magneticForces'
import { CONTACT_THRESHOLD_FT, classifyClearance, conductorDiameterFt } from './contactDetector'
import { isLockout, ProtectionController } from './recloserSequence'

interface FaultGeometry {
  phases: Phase[]
  /** True for two-conductor (line-to-line) faults that produce pairwise repulsion. */
  isPair: boolean
}

/** Which conductors are involved and whether the fault produces a pairwise force. */
export function faultGeometry(ft: FaultType): FaultGeometry {
  switch (ft) {
    case 'AB':
      return { phases: ['A', 'B'], isPair: true }
    case 'BC':
      return { phases: ['B', 'C'], isPair: true }
    case 'AC':
      return { phases: ['A', 'C'], isPair: true }
    case 'AG':
      return { phases: ['A'], isPair: false }
    case 'BG':
      return { phases: ['B'], isPair: false }
    case 'CG':
      return { phases: ['C'], isPair: false }
    case 'ABC':
      // v1 approximation: three-phase handled like a representative pair for now.
      return { phases: ['A', 'B', 'C'], isPair: false }
  }
}

/** The phase not involved in a line-to-line fault (null for non-pair faults). */
function unfaultedPhase(pa: Phase, pb: Phase): Phase | null {
  if (pa === pb) return null
  return (['A', 'B', 'C'] as Phase[]).find((p) => p !== pa && p !== pb) ?? null
}

/**
 * Net lateral force per length (N/m) on the UNFAULTED conductor from the two faulted phases.
 * The unfaulted phase carries a small load current and is pushed away from each high-current
 * faulted conductor (force scales with I_load * I_fault, ~1/distance). The contributions ADD for
 * an OUTER unfaulted phase (both pushes point outward) and CANCEL for a CENTERED one (an A–C
 * fault, where the disturbance is symmetric about it) — so a middle phase barely moves. This is
 * symmetric for mirror faults (A–B and B–C behave alike). The true coherent magnitude depends on
 * the load/fault phase angle, which the steady-RMS model can't resolve, so it is de-rated by
 * UNFAULTED_COUPLING.
 */
function unfaultedForceNPerM(posC: number, posA: number, posB: number, faultA: number): number {
  const dA = Math.max(Math.abs(posC - posA), D_MIN_M)
  const dB = Math.max(Math.abs(posC - posB), D_MIN_M)
  const fA = forcePerLengthNPerM(UNFAULTED_PHASE_CURRENT_A, faultA, dA)
  const fB = forcePerLengthNPerM(UNFAULTED_PHASE_CURRENT_A, faultA, dB)
  return fA * Math.sign(posC - posA || 1) + fB * Math.sign(posC - posB || 1)
}

/** Optional tuning overrides — used by the calibration harness and tests. */
export interface SimTuning {
  forceGain?: number
  noProtClearMs?: number
}

export function runSimulation(scenario: Scenario, tuning: SimTuning = {}): SimulationResult {
  const conductor = getConductor(scenario.conductorTypeId)
  const mp = computeMechParams(scenario, conductor)
  const forceGain = tuning.forceGain ?? EDU_FORCE_GAIN
  // When the relay never trips, clear near the first outward swing peak (~half a swing
  // period), where the conductor is at maximum displacement with ~zero velocity — so the
  // rebound is large and the slap is reliable rather than phase-dependent.
  const noProtClearMs = tuning.noProtClearMs ?? Math.min(1400, Math.max(350, 0.5 * mp.swingPeriodS * 1000))
  const spanM = ftToM(scenario.spanLengthFt)
  const spacingM = ftToM(scenario.phaseSpacingFt)
  const diameterFt = conductorDiameterFt(conductor)
  const thresholdFt = CONTACT_THRESHOLD_FT
  const I = scenario.faultCurrentA

  // Rest lateral positions of each phase along the crossarm (m).
  const restX: Record<Phase, number> = { A: -spacingM, B: 0, C: spacingM }

  const geom = faultGeometry(scenario.faultType)
  const isPair = geom.isPair
  const pa: Phase = geom.phases[0]
  const pb: Phase = isPair ? geom.phases[1] : geom.phases[0]
  const restPairSeparationFt = mToFt(Math.abs(restX[pb] - restX[pa])) || scenario.phaseSpacingFt

  // Pick the operating device by fault position on the radial feeder AND whether the recloser
  // controller is actually in service. `protectionEnabled` is the RECLOSER's enable — it has no
  // effect on the substation relay, which is a real backup device and is always in service:
  //  - downstream fault, recloser enabled  -> the recloser operates (it is set faster); the
  //    substation relay backs it up and resets if the recloser clears first.
  //  - downstream fault, recloser DISABLED -> no current is cleared by the recloser, so the fault
  //    rides through to the substation relay, which clears it on its own pickup/curve/TD.
  //  - upstream fault                      -> no current reaches the recloser at all, regardless
  //    of its enable state; only the substation relay ever sees and clears it.
  const recloserEngaged = scenario.faultLocation === 'downstream' && scenario.protectionEnabled
  const operatingDevice = recloserEngaged ? scenario.protection : scenario.substationRelay
  // Single-pole tripping is a RECLOSER capability for single-phase ground faults (AG/BG/CG) — it
  // opens only the faulted pole, leaving the other two phases energized. The substation
  // relay/breaker has no such capability (always three-pole), so this only applies when the
  // recloser is the actual operating device.
  const singlePoleTrip = recloserEngaged && geom.phases.length === 1
  const controller = new ProtectionController({
    protectionEnabled: true,
    faultCurrentA: I,
    settings: operatingDevice,
    faultStartMs: FAULT_START_MS,
    noProtectionClearMs: noProtClearMs,
    faultPersists: scenario.faultPersists,
    restoreOnReclose: scenario.restoreOnReclose,
  })

  const osc: Record<Phase, OscillatorState> = {
    A: { x: 0, v: 0 },
    B: { x: 0, v: 0 },
    C: { x: 0, v: 0 },
  }

  const frames: SimulationFrame[] = []
  const dtMs = SIM_DT_MS
  const dtS = dtMs / 1000

  let maxDisplacementFt = 0
  let minClearanceFt = Infinity
  let slapOccurred = false
  let slapTimeMs: number | null = null
  let terminalAtMs: number | null = null
  let slappedDuringDeadTime = false
  let prevState: ProtectionState | null = null

  for (let tMs = 0; tMs <= SIM_HORIZON_MS; tMs += dtMs) {
    // --- mechanical state at tMs ---
    const posPaAbs = restX[pa] + osc[pa].x
    const posPbAbs = restX[pb] + osc[pb].x

    let pairSeparationFt: number
    if (isPair) {
      const sepM = Math.max(Math.abs(posPbAbs - posPaAbs), D_MIN_M)
      pairSeparationFt = mToFt(sepM)
    } else {
      pairSeparationFt = restPairSeparationFt
    }
    const clearFt = pairSeparationFt - diameterFt
    const contact = classifyClearance(clearFt)

    // --- protection FSM (re-strike if conductors clashed during this dead time) ---
    const snap = controller.step(tMs, clearFt, thresholdFt, slappedDuringDeadTime)

    // --- magnetic force during energized faults ---
    const forceN: Record<Phase, number> = { A: 0, B: 0, C: 0 }
    let forcePerLen = 0
    if (snap.faultActive && isPair) {
      const sepM = Math.max(Math.abs(posPbAbs - posPaAbs), D_MIN_M)
      forcePerLen = forcePerLengthNPerM(I, I, sepM)
      const fEff = forceGain * forcePerLen * spanM
      // Antiparallel fault currents repel: push each conductor away from the other.
      forceN[pa] = fEff * Math.sign(posPaAbs - posPbAbs || -1)
      forceN[pb] = fEff * Math.sign(posPbAbs - posPaAbs || 1)
      // Unfaulted phase: a much smaller force (load current in the faulted field).
      const pc = unfaultedPhase(pa, pb)
      if (pc) {
        const posPcAbs = restX[pc] + osc[pc].x
        const fcPerLen = unfaultedForceNPerM(posPcAbs, posPaAbs, posPbAbs, I)
        forceN[pc] = UNFAULTED_COUPLING * forceGain * fcPerLen * spanM
      }
    }

    // --- upstream (substation-side) energization ---
    // With the recloser engaged, the substation breaker stays closed, so the section from it to
    // the source side of the recloser remains energized (carrying reduced load) even while the
    // recloser is open — a split. Otherwise the SUBSTATION RELAY is the operating device, and its
    // breaker is the only thing that can clear the fault, so the whole line de-energizes together
    // (recloser disabled, or an upstream fault).
    const upstreamEnergized = recloserEngaged ? true : snap.energized
    // The two healthy phases never lose power on a single-pole trip — EXCEPT the final operation
    // before lockout: a real recloser converts to three-pole on the last trip (it's about to give
    // up and isolate the whole circuit, not stay unbalanced indefinitely), so all 3 phases open
    // together there, same as a non-single-pole-capable device.
    const isFinalShot = isLockout(snap.shot, operatingDevice.shotsToLockout)
    const downstreamHealthyEnergized = singlePoleTrip && !isFinalShot ? true : snap.energized

    // --- record frame at tMs ---
    const dispAFt = mToFt(osc.A.x)
    const dispBFt = mToFt(osc.B.x)
    const dispCFt = mToFt(osc.C.x)
    frames.push({
      tMs,
      state: snap.state,
      energized: snap.energized,
      upstreamEnergized,
      downstreamHealthyEnergized,
      faultActive: snap.faultActive,
      currentA: snap.faultActive ? I : 0,
      dispAFt,
      dispBFt,
      dispCFt,
      pairSeparationFt,
      clearanceFt: clearFt,
      forcePerLenNPerM: forcePerLen,
      contact,
      shot: snap.shot,
    })

    // --- summary stats ---
    maxDisplacementFt = Math.max(maxDisplacementFt, Math.abs(dispAFt), Math.abs(dispBFt), Math.abs(dispCFt))
    if (isPair) minClearanceFt = Math.min(minClearanceFt, clearFt)
    if (contact === 'contact' && !slapOccurred && isPair) {
      slapOccurred = true
      slapTimeMs = tMs
    }

    // --- integrate to tMs + dt ---
    osc.A = stepOscillator(osc.A, forceN.A, mp, dtS)
    osc.B = stepOscillator(osc.B, forceN.B, mp, dtS)
    osc.C = stepOscillator(osc.C, forceN.C, mp, dtS)

    // --- track conductor clashes during the de-energized dead time ---
    if (snap.state === 'DEAD_TIME') {
      if (prevState !== 'DEAD_TIME') slappedDuringDeadTime = false
      if (contact === 'contact') slappedDuringDeadTime = true
    }
    prevState = snap.state

    // --- terminal handling: simulate a short tail to show settling, then stop ---
    if (snap.terminal && terminalAtMs === null) terminalAtMs = tMs
    if (terminalAtMs !== null && tMs >= terminalAtMs + TERMINAL_TAIL_MS) break
  }

  if (!Number.isFinite(minClearanceFt)) {
    minClearanceFt = restPairSeparationFt - diameterFt
  }

  // Derive trip metrics from the timeline events.
  const events = controller.events
  const firstTrip = events.find((e) => e.kind === 'trip')
  const tripTimeMs = firstTrip ? firstTrip.tMs - FAULT_START_MS : null
  const numTrips = events.filter((e) => e.kind === 'trip').length

  const finalState = resolveFinalState(controller, slapOccurred, numTrips)
  const durationMs = frames.length ? frames[frames.length - 1].tMs : 0

  return {
    frames,
    events,
    dtMs,
    durationMs,
    tripTimeMs,
    maxDisplacementFt,
    minClearanceFt,
    slapOccurred,
    slapTimeMs,
    finalState,
    restPairSeparationFt,
    contactThresholdFt: thresholdFt,
    numTrips,
    singlePoleTrip,
    // Populated by computeWitnessFrames (run after this), which mutates this same result object —
    // see useScenarioStore's rerun(): runSimulation() then computeWitnessFrames(scenario, ..., result).
    upstreamFaultEvent: null,
  }
}

/**
 * Compute the motion of an ADJACENT (comparison) span that shares the same fault current
 * and energization timeline as the primary faulted span, but has its own length. Longer
 * spans swing more; this is how the demo shows one span slapping while a shorter one does
 * not. Returns a frame series aligned 1:1 with the primary result's frames.
 *
 * Models a SECOND, independent fault: this upstream span stays energized (carrying load) even
 * after the recloser clears the original downstream fault — split energization. If it clashes
 * while still live, that's a fresh bolted fault upstream of the recloser, sized by
 * `scenario.inducedFaultCurrentA`. From that instant, a second `ProtectionController` for the
 * SUBSTATION RELAY takes over this span's own energization (own pickup/curve/TD/reclose
 * schedule) — and, since the substation breaker is upstream of everything, it also overrides
 * `primary.frames[i].upstreamEnergized`/`.energized` from that point on (mutated in place; the
 * caller already holds this same `primary` object and stores it after this call returns). Only
 * armed for downstream-primary scenarios — an upstream-primary fault already has the relay
 * actively engaged on the original event.
 */
/**
 * Generous cap (ms) on how far an induced upstream fault's own reclose schedule can extend the
 * timeline past the primary run's own horizon (longest relay dead time + a settling tail).
 */
const MAX_UPSTREAM_EXTENSION_MS = 13000

export function computeWitnessFrames(
  scenario: Scenario,
  spanLengthFt: number,
  primary: SimulationResult,
): SimulationFrame[] {
  const conductor = getConductor(scenario.conductorTypeId)
  const mp = computeMechParams({ ...scenario, spanLengthFt }, conductor)
  const spanM = ftToM(spanLengthFt)
  const spacingM = ftToM(scenario.phaseSpacingFt)
  const diameterFt = conductorDiameterFt(conductor)
  const I = scenario.faultCurrentA
  const restX: Record<Phase, number> = { A: -spacingM, B: 0, C: spacingM }

  const geom = faultGeometry(scenario.faultType)
  const isPair = geom.isPair
  const pa: Phase = geom.phases[0]
  const pb: Phase = isPair ? geom.phases[1] : geom.phases[0]
  const restPairSeparationFt = mToFt(Math.abs(restX[pb] - restX[pa])) || scenario.phaseSpacingFt

  const osc: Record<Phase, OscillatorState> = {
    A: { x: 0, v: 0 },
    B: { x: 0, v: 0 },
    C: { x: 0, v: 0 },
  }
  const dtMs = primary.dtMs
  const dtS = dtMs / 1000
  const out: SimulationFrame[] = []

  // Only armed when the recloser is actually engaged (split energization keeping this span
  // independently live) — if it's disabled, the relay is already the operating device for the
  // ORIGINAL fault, and a second overlapping fault on the same relay isn't physically sensible.
  const upstreamFaultArmed = scenario.faultLocation === 'downstream' && scenario.protectionEnabled && isPair
  const inducedI = scenario.inducedFaultCurrentA ?? DEFAULT_INDUCED_FAULT_A
  let upstreamController: ProtectionController | null = null
  let upstreamEventAtMs: number | null = null
  let upstreamPrevState: ProtectionState | null = null
  let upstreamSlappedDuringDeadTime = false
  let upstreamTerminalAtMs: number | null = null

  const originalFrameCount = primary.frames.length
  // The recloser side has nothing left to do once IT has gone terminal — hold its settled
  // energization/state as the baseline for any EXTENSION ticks synthesized below (the substation
  // relay's own multi-second reclose schedule can easily outlast the primary run's own horizon).
  const settledPf = primary.frames[originalFrameCount - 1]

  for (let i = 0; ; i++) {
    const extending = i >= originalFrameCount
    if (!extending && i >= primary.frames.length) break
    if (extending) {
      // Cap how far we extend so a pathological case (relay never resolving) can't run forever.
      if (i - originalFrameCount >= MAX_UPSTREAM_EXTENSION_MS / dtMs) break
      if (!upstreamController) break
      if (upstreamTerminalAtMs != null && settledPf.tMs + (i - originalFrameCount) * dtMs >= upstreamTerminalAtMs + TERMINAL_TAIL_MS) break
    }
    const pf: SimulationFrame = extending
      ? { ...settledPf, tMs: settledPf.tMs + (i - originalFrameCount + 1) * dtMs }
      : primary.frames[i]
    if (extending) primary.frames.push(pf)
    const posPa = restX[pa] + osc[pa].x
    const posPb = restX[pb] + osc[pb].x
    const pairSeparationFt = isPair
      ? mToFt(Math.max(Math.abs(posPb - posPa), D_MIN_M))
      : restPairSeparationFt
    const clearFt = pairSeparationFt - diameterFt
    const contact = classifyClearance(clearFt)

    // --- strike / advance the induced upstream fault (substation relay's own FSM) ---
    if (upstreamFaultArmed && !upstreamController && pf.upstreamEnergized && contact === 'contact') {
      upstreamController = new ProtectionController({
        protectionEnabled: true,
        faultCurrentA: inducedI,
        settings: scenario.substationRelay,
        faultStartMs: pf.tMs,
      })
      upstreamEventAtMs = pf.tMs
    }
    const upSnap = upstreamController?.step(pf.tMs, clearFt, CONTACT_THRESHOLD_FT, upstreamSlappedDuringDeadTime)
    if (upSnap) {
      if (upSnap.state === 'DEAD_TIME') {
        if (upstreamPrevState !== 'DEAD_TIME') upstreamSlappedDuringDeadTime = false
        if (contact === 'contact') upstreamSlappedDuringDeadTime = true
      }
      upstreamPrevState = upSnap.state
      if (upSnap.terminal && upstreamTerminalAtMs === null) upstreamTerminalAtMs = pf.tMs
      // The substation breaker now governs this span's energization — and, since it's upstream
      // of the recloser too, the primary (downstream) frame at this same tick as well. Surface
      // the induced fault as a fault (not load current) while the relay is actively timing it out.
      primary.frames[i] = {
        ...pf,
        upstreamEnergized: upSnap.energized,
        energized: pf.energized && upSnap.energized,
        faultActive: pf.faultActive || upSnap.faultActive,
        currentA: upSnap.faultActive ? inducedI : pf.currentA,
      }
    }
    const pfEff = primary.frames[i]

    const faultActive = upSnap ? upSnap.faultActive : pf.faultActive
    const currentMag = upSnap?.faultActive ? inducedI : I

    const forceN: Record<Phase, number> = { A: 0, B: 0, C: 0 }
    let forcePerLen = 0
    if (faultActive && isPair) {
      const sepM = Math.max(Math.abs(posPb - posPa), D_MIN_M)
      forcePerLen = forcePerLengthNPerM(currentMag, currentMag, sepM)
      const fEff = EDU_FORCE_GAIN * forcePerLen * spanM
      forceN[pa] = fEff * Math.sign(posPa - posPb || -1)
      forceN[pb] = fEff * Math.sign(posPb - posPa || 1)
      const pc = unfaultedPhase(pa, pb)
      if (pc) {
        const posPc = restX[pc] + osc[pc].x
        const fcPerLen = unfaultedForceNPerM(posPc, posPa, posPb, currentMag)
        forceN[pc] = UNFAULTED_COUPLING * EDU_FORCE_GAIN * fcPerLen * spanM
      }
    }

    // Upstream spans are energized by the substation breaker: they stay live and carry reduced
    // load current once the recloser opens, full load once everything is back to normal, and the
    // induced-fault magnitude while that secondary fault is active.
    const upstreamCurrentA = faultActive
      ? currentMag
      : pfEff.energized
        ? NOMINAL_LOAD_CURRENT_A
        : pfEff.upstreamEnergized
          ? REDUCED_LOAD_CURRENT_A
          : 0

    out.push({
      tMs: pfEff.tMs,
      state: upSnap ? upSnap.state : pfEff.state,
      energized: pfEff.upstreamEnergized,
      upstreamEnergized: pfEff.upstreamEnergized,
      downstreamHealthyEnergized: pfEff.upstreamEnergized,
      faultActive,
      currentA: upstreamCurrentA,
      dispAFt: mToFt(osc.A.x),
      dispBFt: mToFt(osc.B.x),
      dispCFt: mToFt(osc.C.x),
      pairSeparationFt,
      clearanceFt: clearFt,
      forcePerLenNPerM: forcePerLen,
      contact,
      shot: upSnap ? upSnap.shot : pfEff.shot,
    })

    osc.A = stepOscillator(osc.A, forceN.A, mp, dtS)
    osc.B = stepOscillator(osc.B, forceN.B, mp, dtS)
    osc.C = stepOscillator(osc.C, forceN.C, mp, dtS)
  }

  primary.upstreamFaultEvent = buildUpstreamFaultEvent(upstreamController, upstreamEventAtMs)
  primary.durationMs = primary.frames[primary.frames.length - 1]?.tMs ?? primary.durationMs

  return out
}

function buildUpstreamFaultEvent(
  controller: ProtectionController | null,
  atMs: number | null,
): UpstreamFaultEvent | null {
  if (!controller || atMs == null) return null
  const events = controller.events
  const firstTrip = events.find((e) => e.kind === 'trip')
  const numTrips = events.filter((e) => e.kind === 'trip').length
  return {
    atMs,
    tripTimeMs: firstTrip ? firstTrip.tMs - atMs : null,
    finalState: resolveFinalState(controller, true, numTrips),
  }
}

function resolveFinalState(
  controller: ProtectionController,
  slapOccurred: boolean,
  numTrips: number,
): FinalState {
  // Inspect the last emitted terminal-ish event.
  const events = controller.events
  const last = events[events.length - 1]
  if (last?.kind === 'restored') return 'RESTORED'
  if (last?.kind === 'lockout') return 'LOCKOUT'
  if (slapOccurred) return 'SLAP_FAULT'
  if (numTrips === 0) return 'NO_TRIP'
  return 'RESTORED'
}
