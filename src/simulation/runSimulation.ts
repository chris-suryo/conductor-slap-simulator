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

/**
 * Live surface-to-surface clearance + center-to-center separation for ONE span's own oscillator
 * state, generalized over pair / ground / three-phase fault geometries. Shared by the main loop
 * and the upstream comparison spans (SPAN 1 / SPAN 2) so every span's clearance is computed by
 * the exact same physics, just against its own conductor positions.
 */
function spanClearanceFt(
  osc: Record<Phase, OscillatorState>,
  restX: Record<Phase, number>,
  geom: FaultGeometry,
  restPairSeparationFt: number,
  diameterFt: number,
): { pairSeparationFt: number; clearFt: number } {
  const isPair = geom.isPair
  const isThreePhase = geom.phases.length === 3
  const pa: Phase = geom.phases[0]
  const pb: Phase = isPair ? geom.phases[1] : geom.phases[0]
  const posPaAbs = restX[pa] + osc[pa].x
  const posPbAbs = restX[pb] + osc[pb].x

  let pairSeparationFt: number
  if (isPair) {
    pairSeparationFt = mToFt(Math.max(Math.abs(posPbAbs - posPaAbs), D_MIN_M))
  } else if (isThreePhase) {
    const posAAbs = restX.A + osc.A.x
    const posBAbs = restX.B + osc.B.x
    const posCAbs = restX.C + osc.C.x
    const sepABm = Math.max(Math.abs(posAAbs - posBAbs), D_MIN_M)
    const sepBCm = Math.max(Math.abs(posBAbs - posCAbs), D_MIN_M)
    const sepACm = Math.max(Math.abs(posAAbs - posCAbs), D_MIN_M)
    pairSeparationFt = mToFt(Math.min(sepABm, sepBCm, sepACm))
  } else {
    pairSeparationFt = restPairSeparationFt
  }
  return { pairSeparationFt, clearFt: pairSeparationFt - diameterFt }
}

/**
 * Magnetic force on each conductor of ONE span given its own oscillator state, generalized over
 * pair / ground / three-phase fault geometries — the same physics as `spanClearanceFt`'s sibling
 * branching, shared by the main loop and the upstream comparison spans.
 */
function faultForces(
  geom: FaultGeometry,
  osc: Record<Phase, OscillatorState>,
  restX: Record<Phase, number>,
  faultActive: boolean,
  currentA: number,
  forceGain: number,
  spanM: number,
): { forceN: Record<Phase, number>; forcePerLen: number } {
  const forceN: Record<Phase, number> = { A: 0, B: 0, C: 0 }
  let forcePerLen = 0
  if (!faultActive) return { forceN, forcePerLen }

  const isPair = geom.isPair
  const isThreePhase = geom.phases.length === 3
  const pa: Phase = geom.phases[0]
  const pb: Phase = isPair ? geom.phases[1] : geom.phases[0]
  const posPaAbs = restX[pa] + osc[pa].x
  const posPbAbs = restX[pb] + osc[pb].x

  if (isPair) {
    const sepM = Math.max(Math.abs(posPbAbs - posPaAbs), D_MIN_M)
    forcePerLen = forcePerLengthNPerM(currentA, currentA, sepM)
    const fEff = forceGain * forcePerLen * spanM
    // Antiparallel fault currents repel: push each conductor away from the other.
    forceN[pa] = fEff * Math.sign(posPaAbs - posPbAbs || -1)
    forceN[pb] = fEff * Math.sign(posPbAbs - posPaAbs || 1)
    // Unfaulted phase: a much smaller force (load current in the faulted field).
    const pc = unfaultedPhase(pa, pb)
    if (pc) {
      const posPcAbs = restX[pc] + osc[pc].x
      const fcPerLen = unfaultedForceNPerM(posPcAbs, posPaAbs, posPbAbs, currentA)
      forceN[pc] = UNFAULTED_COUPLING * forceGain * fcPerLen * spanM
    }
  } else if (geom.phases.length === 1) {
    // Ground fault (single faulted conductor): there's no pairwise repulsion (no second
    // high-current conductor to repel against), but the two HEALTHY phases still carry load
    // current sitting in the faulted phase's field, so each feels a small coupling force —
    // same physics/de-rating as the unfaulted phase in an L-L fault, just from one source.
    for (const ph of ['A', 'B', 'C'] as Phase[]) {
      if (ph === pa) continue
      const posPhAbs = restX[ph] + osc[ph].x
      const dM = Math.max(Math.abs(posPhAbs - posPaAbs), D_MIN_M)
      const fPerLen = forcePerLengthNPerM(UNFAULTED_PHASE_CURRENT_A, currentA, dM)
      forceN[ph] = UNFAULTED_COUPLING * forceGain * fPerLen * Math.sign(posPhAbs - posPaAbs || 1) * spanM
    }
  } else if (isThreePhase) {
    // Three-phase fault: all three conductors carry the full fault current, so every pair
    // repels (same I-I formula as an L-L fault, applied to all 3 pairs). The two OUTER phases
    // (A, C) get pushed further outward because both their contributions point the same way;
    // the CENTER phase (B) gets opposing, largely-cancelling contributions and stays close to
    // rest — same cancellation logic already used for a centered unfaulted phase in an A–C
    // fault, just symmetric across all three here.
    const posAAbs = restX.A + osc.A.x
    const posBAbs = restX.B + osc.B.x
    const posCAbs = restX.C + osc.C.x
    const sepABm = Math.max(Math.abs(posAAbs - posBAbs), D_MIN_M)
    const sepBCm = Math.max(Math.abs(posBAbs - posCAbs), D_MIN_M)
    const sepACm = Math.max(Math.abs(posAAbs - posCAbs), D_MIN_M)
    const fAB = forcePerLengthNPerM(currentA, currentA, sepABm)
    const fBC = forcePerLengthNPerM(currentA, currentA, sepBCm)
    const fAC = forcePerLengthNPerM(currentA, currentA, sepACm)
    const fABeff = forceGain * fAB * spanM
    const fBCeff = forceGain * fBC * spanM
    const fACeff = forceGain * fAC * spanM
    forceN.A = fABeff * Math.sign(posAAbs - posBAbs || -1) + fACeff * Math.sign(posAAbs - posCAbs || -1)
    forceN.B = fABeff * Math.sign(posBAbs - posAAbs || 1) + fBCeff * Math.sign(posBAbs - posCAbs || -1)
    forceN.C = fBCeff * Math.sign(posCAbs - posBAbs || 1) + fACeff * Math.sign(posCAbs - posAAbs || 1)
    // The reported scalar force tracks the same (closest) pair as `pairSeparationFt` — equal
    // currents mean the closest pair is always the highest-force pair.
    forcePerLen = Math.max(fAB, fBC, fAC)
  }
  return { forceN, forcePerLen }
}

/** Optional tuning overrides — used by the calibration harness and tests. */
export interface SimTuning {
  forceGain?: number
  noProtClearMs?: number
}

export function runSimulation(scenario: Scenario, tuning: SimTuning = {}): SimulationResult {
  const conductor = getConductor(scenario.conductorTypeId)
  // The instrumented/primary span is whichever one actually carries the fault: SPAN 3
  // (downstream of the recloser) for a downstream fault, or SPAN 1 (nearest the source, between
  // it and the mid pole) for an upstream fault — see `Scenario.faultLocation`. Everything below
  // (mass/sag/swing-period/force) uses THIS span's own length, so `result.frames` always
  // represents whichever span is physically faulted.
  const activeSpanLengthFt =
    scenario.faultLocation === 'upstream' ? scenario.firstSpanLengthFt : scenario.spanLengthFt
  const mp = computeMechParams({ ...scenario, spanLengthFt: activeSpanLengthFt }, conductor)
  const forceGain = tuning.forceGain ?? EDU_FORCE_GAIN
  // When the relay never trips, clear near the first outward swing peak (~half a swing
  // period), where the conductor is at maximum displacement with ~zero velocity — so the
  // rebound is large and the slap is reliable rather than phase-dependent.
  const noProtClearMs = tuning.noProtClearMs ?? Math.min(1400, Math.max(350, 0.5 * mp.swingPeriodS * 1000))
  const spanM = ftToM(activeSpanLengthFt)
  const spacingM = ftToM(scenario.phaseSpacingFt)
  const diameterFt = conductorDiameterFt(conductor)
  const thresholdFt = CONTACT_THRESHOLD_FT
  const I = scenario.faultCurrentA

  // Rest lateral positions of each phase along the crossarm (m).
  const restX: Record<Phase, number> = { A: -spacingM, B: 0, C: spacingM }

  const geom = faultGeometry(scenario.faultType)
  const isPair = geom.isPair
  const isThreePhase = geom.phases.length === 3
  // Whether this fault type produces a live, motion-dependent pairwise clearance at all (vs. a
  // ground fault's single conductor, whose "pair" separation is a fixed/irrelevant constant).
  // Used to gate minClearanceFt tracking and slap detection the same way `isPair` already did.
  const hasPairwiseClearance = isPair || isThreePhase
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
    const { pairSeparationFt, clearFt } = spanClearanceFt(osc, restX, geom, restPairSeparationFt, diameterFt)
    const contact = classifyClearance(clearFt)

    // --- protection FSM (re-strike if conductors clashed during this dead time) ---
    const snap = controller.step(tMs, clearFt, thresholdFt, slappedDuringDeadTime)

    // --- magnetic force during energized faults ---
    const { forceN, forcePerLen } = faultForces(geom, osc, restX, snap.faultActive, I, forceGain, spanM)

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
    if (hasPairwiseClearance) minClearanceFt = Math.min(minClearanceFt, clearFt)
    if (contact === 'contact' && !slapOccurred && hasPairwiseClearance) {
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
    // Populated by computeUpstreamSpanFrames (run after this), which mutates this same result
    // object — see useScenarioStore's rerun(): runSimulation() then computeUpstreamSpanFrames(...).
    upstreamFaultEvent: null,
  }
}

/**
 * Generous cap (ms) on how far an induced upstream fault's own reclose schedule can extend the
 * timeline past the primary run's own horizon (longest relay dead time + a settling tail).
 */
const MAX_UPSTREAM_EXTENSION_MS = 13000

/**
 * Compute the motion of BOTH upstream comparison spans — SPAN 1 (nearest the source) and SPAN 2
 * (between the mid pole and the recloser, upstream of it) — each with its OWN length/mechanics,
 * so each has its own independent clearance and magnetic force (mirroring the primary/SPAN 3
 * physics via the shared `spanClearanceFt`/`faultForces` helpers). Returns two frame series
 * aligned 1:1 with the primary (SPAN 3) result's frames.
 *
 * Both spans stay energized (carrying load) after the recloser clears the original downstream
 * fault — split energization. If EITHER clashes while still live, that's a fresh bolted fault
 * upstream of the recloser, sized by `scenario.inducedFaultCurrentA`; a single shared
 * `ProtectionController` for the SUBSTATION RELAY (the one device that can see/clear it — it's
 * upstream of both spans) takes over from there, and overrides
 * `primary.frames[i].upstreamEnergized`/`.energized` from that point on (mutated in place; the
 * caller already holds this same `primary` object and stores it after this call returns).
 *
 * Whichever span clashes FIRST is the induced fault's origin (SPAN 1 checked first as a
 * deterministic tie-break on a simultaneous clash — vanishingly rare in practice). SPAN 1, being
 * upstream of SPAN 2 too, keeps carrying the induced current regardless of which span is the
 * origin; SPAN 2 only carries it if SPAN 2 itself is the origin — a fault AT SPAN 1 starves
 * everything downstream of it (including SPAN 2) of current, the same radial-feeder logic
 * already governing the original downstream fault.
 *
 * Only armed for downstream-primary scenarios with a real pairwise/three-phase fault type — a
 * ground fault's single conductor has no pairwise force to slap with (see `runSimulation()`),
 * and an upstream-located primary fault already has the relay actively engaged on the original
 * event.
 */
export function computeUpstreamSpanFrames(
  scenario: Scenario,
  primary: SimulationResult,
): { span1Frames: SimulationFrame[]; span2Frames: SimulationFrame[] } {
  const conductor = getConductor(scenario.conductorTypeId)
  const mp1 = computeMechParams({ ...scenario, spanLengthFt: scenario.firstSpanLengthFt }, conductor)
  const mp2 = computeMechParams({ ...scenario, spanLengthFt: scenario.secondSpanLengthFt }, conductor)
  const spanM1 = ftToM(scenario.firstSpanLengthFt)
  const spanM2 = ftToM(scenario.secondSpanLengthFt)
  const spacingM = ftToM(scenario.phaseSpacingFt)
  const diameterFt = conductorDiameterFt(conductor)
  const I = scenario.faultCurrentA
  const restX: Record<Phase, number> = { A: -spacingM, B: 0, C: spacingM }

  const geom = faultGeometry(scenario.faultType)
  const isPair = geom.isPair
  const isThreePhase = geom.phases.length === 3
  const hasPairwiseClearance = isPair || isThreePhase
  const pa: Phase = geom.phases[0]
  const pb: Phase = isPair ? geom.phases[1] : geom.phases[0]
  const restPairSeparationFt = mToFt(Math.abs(restX[pb] - restX[pa])) || scenario.phaseSpacingFt

  const osc1: Record<Phase, OscillatorState> = { A: { x: 0, v: 0 }, B: { x: 0, v: 0 }, C: { x: 0, v: 0 } }
  const osc2: Record<Phase, OscillatorState> = { A: { x: 0, v: 0 }, B: { x: 0, v: 0 }, C: { x: 0, v: 0 } }
  const dtMs = primary.dtMs
  const dtS = dtMs / 1000
  const span1Frames: SimulationFrame[] = []
  const span2Frames: SimulationFrame[] = []

  const upstreamFaultArmed =
    scenario.faultLocation === 'downstream' && scenario.protectionEnabled && hasPairwiseClearance
  const inducedI = scenario.inducedFaultCurrentA ?? DEFAULT_INDUCED_FAULT_A
  let upstreamController: ProtectionController | null = null
  let upstreamEventAtMs: number | null = null
  let originSpan: 1 | 2 | null = null
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

    // --- each span's own LIVE positional clearance (independent of fault current/state) ---
    const clear1 = spanClearanceFt(osc1, restX, geom, restPairSeparationFt, diameterFt)
    const clear2 = spanClearanceFt(osc2, restX, geom, restPairSeparationFt, diameterFt)
    const contact1 = classifyClearance(clear1.clearFt)
    const contact2 = classifyClearance(clear2.clearFt)

    // --- strike / advance the induced upstream fault (substation relay's own FSM) ---
    if (upstreamFaultArmed && !upstreamController && pf.upstreamEnergized) {
      if (contact1 === 'contact') originSpan = 1
      else if (contact2 === 'contact') originSpan = 2
      if (originSpan != null) {
        upstreamController = new ProtectionController({
          protectionEnabled: true,
          faultCurrentA: inducedI,
          settings: scenario.substationRelay,
          faultStartMs: pf.tMs,
        })
        upstreamEventAtMs = pf.tMs
      }
    }
    // Feed the controller the ORIGIN span's own live clearance — that's the physical fault
    // location its reclose-vs-restrike decision actually depends on.
    const originClearFt = originSpan === 2 ? clear2.clearFt : clear1.clearFt
    const upSnap = upstreamController?.step(pf.tMs, originClearFt, CONTACT_THRESHOLD_FT, upstreamSlappedDuringDeadTime)
    if (upSnap) {
      if (upSnap.state === 'DEAD_TIME') {
        if (upstreamPrevState !== 'DEAD_TIME') upstreamSlappedDuringDeadTime = false
        if (classifyClearance(originClearFt) === 'contact') upstreamSlappedDuringDeadTime = true
      }
      upstreamPrevState = upSnap.state
      if (upSnap.terminal && upstreamTerminalAtMs === null) upstreamTerminalAtMs = pf.tMs
      // The substation breaker now governs both spans' energization — and, since it's upstream
      // of the recloser too, the primary (downstream) frame at this same tick as well. Surface
      // the induced fault as a fault (not load current) while the relay is actively timing it out.
      // `downstreamHealthyEnergized` must be ANDed too (not just `energized`): once the substation
      // breaker itself is open, there's no source at all, so the recloser's healthy phases (which
      // drive its own load-current display) can't still read as energized just because the
      // recloser's own controller happened to restore earlier.
      primary.frames[i] = {
        ...pf,
        upstreamEnergized: upSnap.energized,
        energized: pf.energized && upSnap.energized,
        downstreamHealthyEnergized: pf.downstreamHealthyEnergized && upSnap.energized,
        faultActive: pf.faultActive || upSnap.faultActive,
        currentA: upSnap.faultActive ? inducedI : pf.currentA,
      }
    }
    const pfEff = primary.frames[i]

    // --- which spans actually carry current this tick ---
    // The ORIGINAL downstream fault (before the recloser clears it) flows through BOTH upstream
    // spans (they're in series toward the recloser) — `pf.faultActive` already reflects that for
    // both, no origin distinction needed. Once an INDUCED fault fires, SPAN 1 keeps carrying it
    // regardless of origin; SPAN 2 only carries it if SPAN 2 itself is the origin. For an UPSTREAM
    // fault, `pf` is the primary span-1 fault itself (see `runSimulation`'s `activeSpanLengthFt`)
    // — it doesn't flow through these two independently-modeled witness spans at all, so ignore it
    // here (only an induced strike, which is downstream-only, can move these).
    const downstreamFault = scenario.faultLocation === 'downstream'
    const inducedActive = upSnap?.faultActive ?? false
    const span1FaultActive = (downstreamFault && pf.faultActive) || inducedActive
    const span1Current = inducedActive ? inducedI : I
    const span2FaultActive = (downstreamFault && pf.faultActive) || (inducedActive && originSpan === 2)
    const span2Current = inducedActive && originSpan === 2 ? inducedI : I

    const mech1 = faultForces(geom, osc1, restX, span1FaultActive, span1Current, EDU_FORCE_GAIN, spanM1)
    const mech2 = faultForces(geom, osc2, restX, span2FaultActive, span2Current, EDU_FORCE_GAIN, spanM2)

    // Upstream spans are energized by the substation breaker: they stay live and carry reduced
    // load current once the recloser opens, full load once everything is back to normal, and the
    // induced-fault magnitude while that secondary fault is active.
    const upstreamCurrentA = (currentMag: number, faultActive: boolean) =>
      faultActive
        ? currentMag
        : pfEff.energized
          ? NOMINAL_LOAD_CURRENT_A
          : pfEff.upstreamEnergized
            ? REDUCED_LOAD_CURRENT_A
            : 0

    span1Frames.push({
      tMs: pfEff.tMs,
      state: upSnap ? upSnap.state : pfEff.state,
      energized: pfEff.upstreamEnergized,
      upstreamEnergized: pfEff.upstreamEnergized,
      downstreamHealthyEnergized: pfEff.upstreamEnergized,
      faultActive: span1FaultActive,
      currentA: upstreamCurrentA(span1Current, span1FaultActive),
      dispAFt: mToFt(osc1.A.x),
      dispBFt: mToFt(osc1.B.x),
      dispCFt: mToFt(osc1.C.x),
      pairSeparationFt: clear1.pairSeparationFt,
      clearanceFt: clear1.clearFt,
      forcePerLenNPerM: mech1.forcePerLen,
      contact: contact1,
      shot: upSnap ? upSnap.shot : pfEff.shot,
    })
    span2Frames.push({
      tMs: pfEff.tMs,
      state: upSnap ? upSnap.state : pfEff.state,
      energized: pfEff.upstreamEnergized,
      upstreamEnergized: pfEff.upstreamEnergized,
      downstreamHealthyEnergized: pfEff.upstreamEnergized,
      faultActive: span2FaultActive,
      currentA: upstreamCurrentA(span2Current, span2FaultActive),
      dispAFt: mToFt(osc2.A.x),
      dispBFt: mToFt(osc2.B.x),
      dispCFt: mToFt(osc2.C.x),
      pairSeparationFt: clear2.pairSeparationFt,
      clearanceFt: clear2.clearFt,
      forcePerLenNPerM: mech2.forcePerLen,
      contact: contact2,
      shot: upSnap ? upSnap.shot : pfEff.shot,
    })

    osc1.A = stepOscillator(osc1.A, mech1.forceN.A, mp1, dtS)
    osc1.B = stepOscillator(osc1.B, mech1.forceN.B, mp1, dtS)
    osc1.C = stepOscillator(osc1.C, mech1.forceN.C, mp1, dtS)
    osc2.A = stepOscillator(osc2.A, mech2.forceN.A, mp2, dtS)
    osc2.B = stepOscillator(osc2.B, mech2.forceN.B, mp2, dtS)
    osc2.C = stepOscillator(osc2.C, mech2.forceN.C, mp2, dtS)
  }

  primary.upstreamFaultEvent = buildUpstreamFaultEvent(upstreamController, upstreamEventAtMs, originSpan)
  primary.durationMs = primary.frames[primary.frames.length - 1]?.tMs ?? primary.durationMs

  return { span1Frames, span2Frames }
}

function buildUpstreamFaultEvent(
  controller: ProtectionController | null,
  atMs: number | null,
  originSpan: 1 | 2 | null,
): UpstreamFaultEvent | null {
  if (!controller || atMs == null || originSpan == null) return null
  const events = controller.events
  const firstTrip = events.find((e) => e.kind === 'trip')
  const numTrips = events.filter((e) => e.kind === 'trip').length
  return {
    atMs,
    tripTimeMs: firstTrip ? firstTrip.tMs - atMs : null,
    finalState: resolveFinalState(controller, true, numTrips),
    originSpan,
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
