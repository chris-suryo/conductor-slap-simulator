/**
 * Core domain types for the Conductor Slap Simulator.
 *
 * EDUCATIONAL MODEL — these types describe a simplified, teaching-grade model of
 * overhead distribution conductor motion under short-circuit magnetic forces and
 * protective relay / recloser sequencing. It is NOT a certified design or
 * relay-setting validation tool.
 *
 * Engineering background encoded across this module:
 *  - Conductor slapping is a short-circuit phenomenon driven by magnetic forces
 *    between phase conductors (EPRI; Electric Power Distribution Handbook
 *    conductor-slapping / critical-clearing-time precedent).
 *  - The subsequent "slap" tends to occur as conductors swing back together after
 *    the fault is cleared (T.A. Ward, IEEE — conductor motion from short-circuit
 *    forces can create a higher-stress subsequent fault).
 *  - Reclosers sense overcurrent, interrupt, reclose after a dead time, and lock
 *    out after a preset number of operations (Eaton; NOJA).
 */

export type FaultType = 'AB' | 'BC' | 'AC' | 'AG' | 'BG' | 'CG' | 'ABC'

export type Phase = 'A' | 'B' | 'C'

export type CurveType =
  | 'definite'
  | 'iec-standard-inverse'
  | 'iec-very-inverse'
  | 'iec-extremely-inverse'
  // SEL "US" curve set (U1–U5). NOT IEEE C37.112 — SEL's US curves are markedly faster and
  // are what the field SEL recloser/relay controls actually run. Form: t = TD·(A + B/(M^P − 1)).
  | 'us-moderately-inverse'
  | 'us-inverse'
  | 'us-very-inverse'
  | 'us-extremely-inverse'
  | 'us-short-time-inverse'

/** How a given recloser operation ("shot") decides its trip time. */
export type ShotCurveMode = 'instantaneous' | 'inverse' | 'definite'

export interface ConductorType {
  id: string
  name: string
  /** AAC, ACSR, etc. */
  material: string
  /** Overall conductor diameter (inches). */
  diameterIn: number
  /** Unit weight (lb per 1000 ft) — common catalog form. */
  weightLbPerKft: number
  /** Approximate rated ampacity (A) for reference only. */
  ratedAmpacityA: number
  description?: string
}

export interface RecloseShot {
  operation: 1 | 2 | 3 | 4
  curveMode: ShotCurveMode
  /** Dead time after THIS trip before the next reclose attempt (ms). */
  recloseDelayMs: number
}

export interface ProtectionSettings {
  phasePickupA: number
  groundPickupA: number
  phaseInstantaneousPickupA: number
  groundInstantaneousPickupA: number
  curveType: CurveType
  /** Time multiplier setting (TMS) for inverse curves. */
  timeMultiplier: number
  /** Trip time for definite-time mode (ms). */
  definiteTimeMs: number
  /** Breaker / interrupter mechanical operating time added to the relay decision (ms). */
  breakerOpenTimeMs: number
  /** Number of trip operations before lockout (reclose attempts = shotsToLockout - 1). */
  shotsToLockout: number
  recloseShots: RecloseShot[]
}

export interface Scenario {
  voltageClassKv: number
  /** Length of the faulted span (the instrumented one driving protection & charts). */
  spanLengthFt: number
  /** Length of the adjacent comparison span on the other side of the center pole. */
  secondSpanLengthFt: number
  phaseSpacingFt: number
  sagFt: number
  faultCurrentA: number
  faultType: FaultType
  conductorTypeId: string
  protectionEnabled: boolean
  protection: ProtectionSettings
}

/** Finite-state machine states for the protection / reclose sequence. */
export type ProtectionState =
  | 'NORMAL'
  | 'FAULT_ACTIVE'
  | 'RELAY_TIMING'
  | 'TRIP_COMMAND'
  | 'BREAKER_OPENING'
  | 'DEAD_TIME'
  | 'RECLOSE'
  | 'RESTORED'
  | 'LOCKOUT'

export type ContactStatus = 'safe' | 'near-miss' | 'contact'

export type FinalState = 'RESTORED' | 'SLAP_FAULT' | 'LOCKOUT' | 'NO_TRIP'

/** One sampled instant of the simulation. */
export interface SimulationFrame {
  tMs: number
  state: ProtectionState
  /** Line is energized (voltage applied). */
  energized: boolean
  /** Fault current is actually flowing (energized AND a fault is present). */
  faultActive: boolean
  /** Magnitude of fault current used this frame (A); 0 when not faulting. */
  currentA: number
  /** Lateral displacement of each phase midspan from rest (ft, signed along crossarm). */
  dispAFt: number
  dispBFt: number
  dispCFt: number
  /** Center-to-center separation of the faulted conductor pair (ft). */
  pairSeparationFt: number
  /** Surface-to-surface clearance of the faulted pair (ft). */
  clearanceFt: number
  /** Force per unit length on the faulted pair (N/m); 0 when not faulting. */
  forcePerLenNPerM: number
  contact: ContactStatus
  /** Operation index currently in progress (1 = first fault, 0 = none/normal). */
  shot: number
}

export type TimelineEventKind =
  | 'normal'
  | 'fault'
  | 'trip'
  | 'open'
  | 'reclose'
  | 'restored'
  | 'lockout'
  | 'slap'

export interface TimelineEvent {
  tMs: number
  state: ProtectionState
  kind: TimelineEventKind
  label: string
  detail?: string
  shot?: number
}

export interface SimulationResult {
  frames: SimulationFrame[]
  events: TimelineEvent[]
  dtMs: number
  durationMs: number
  /** Time of the FIRST trip relative to fault start (ms); null if the relay never trips. */
  tripTimeMs: number | null
  maxDisplacementFt: number
  minClearanceFt: number
  slapOccurred: boolean
  slapTimeMs: number | null
  finalState: FinalState
  /** Static rest separation of the faulted pair (ft). */
  restPairSeparationFt: number
  /** Clearance at/under which a slap is registered (ft). */
  contactThresholdFt: number
  numTrips: number
}
