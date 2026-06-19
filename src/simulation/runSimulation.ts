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
} from './types'
import {
  D_MIN_M,
  EDU_FORCE_GAIN,
  FAULT_START_MS,
  SIM_DT_MS,
  SIM_HORIZON_MS,
  TERMINAL_TAIL_MS,
} from './constants'
import { ftToM, mToFt } from './units'
import { getConductor } from './conductorCatalog'
import { computeMechParams, stepOscillator, type OscillatorState } from './motionSolver'
import { forcePerLengthNPerM } from './magneticForces'
import { CONTACT_THRESHOLD_FT, classifyClearance, conductorDiameterFt } from './contactDetector'
import { ProtectionController } from './recloserSequence'

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
  const noProtClearMs = tuning.noProtClearMs ?? Math.min(900, Math.max(350, 0.5 * mp.swingPeriodS * 1000))
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

  const controller = new ProtectionController({
    protectionEnabled: scenario.protectionEnabled,
    faultCurrentA: I,
    settings: scenario.protection,
    faultStartMs: FAULT_START_MS,
    noProtectionClearMs: noProtClearMs,
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
    }

    // --- record frame at tMs ---
    const dispAFt = mToFt(osc.A.x)
    const dispBFt = mToFt(osc.B.x)
    const dispCFt = mToFt(osc.C.x)
    frames.push({
      tMs,
      state: snap.state,
      energized: snap.energized,
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
  }
}

/**
 * Compute the motion of an ADJACENT (comparison) span that shares the same fault current
 * and energization timeline as the primary faulted span, but has its own length. Longer
 * spans swing more; this is how the demo shows one span slapping while a shorter one does
 * not. Returns a frame series aligned 1:1 with the primary result's frames.
 */
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
  const dtS = primary.dtMs / 1000
  const out: SimulationFrame[] = []

  for (const pf of primary.frames) {
    const posPa = restX[pa] + osc[pa].x
    const posPb = restX[pb] + osc[pb].x
    const pairSeparationFt = isPair
      ? mToFt(Math.max(Math.abs(posPb - posPa), D_MIN_M))
      : restPairSeparationFt
    const clearFt = pairSeparationFt - diameterFt

    const forceN: Record<Phase, number> = { A: 0, B: 0, C: 0 }
    let forcePerLen = 0
    if (pf.faultActive && isPair) {
      const sepM = Math.max(Math.abs(posPb - posPa), D_MIN_M)
      forcePerLen = forcePerLengthNPerM(I, I, sepM)
      const fEff = EDU_FORCE_GAIN * forcePerLen * spanM
      forceN[pa] = fEff * Math.sign(posPa - posPb || -1)
      forceN[pb] = fEff * Math.sign(posPb - posPa || 1)
    }

    out.push({
      tMs: pf.tMs,
      state: pf.state,
      energized: pf.energized,
      faultActive: pf.faultActive,
      currentA: pf.currentA,
      dispAFt: mToFt(osc.A.x),
      dispBFt: mToFt(osc.B.x),
      dispCFt: mToFt(osc.C.x),
      pairSeparationFt,
      clearanceFt: clearFt,
      forcePerLenNPerM: forcePerLen,
      contact: classifyClearance(clearFt),
      shot: pf.shot,
    })

    osc.A = stepOscillator(osc.A, forceN.A, mp, dtS)
    osc.B = stepOscillator(osc.B, forceN.B, mp, dtS)
    osc.C = stepOscillator(osc.C, forceN.C, mp, dtS)
  }

  return out
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
