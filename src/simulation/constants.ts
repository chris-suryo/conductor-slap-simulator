/**
 * Physical constants, protection-curve constants, and EDUCATIONAL tuning constants.
 *
 * The "tuning" block is explicitly calibrated so the default demo scenario tells the
 * teaching story (slow/no clearing -> conductors slap; fast protective clearing ->
 * reduced swing and a successful reclose). These are simplified visual/educational
 * constants, not field-derived mechanical parameters.
 */
import type { CurveType } from './types'

/** Magnetic permeability of free space (H/m). */
export const MU_0 = 4 * Math.PI * 1e-7

/** Gravitational acceleration (m/s^2). */
export const GRAVITY = 9.81

export const LINE_FREQ_HZ = 60

/** IEC 60255-style inverse-curve constants: t = TMS * (k / (M^alpha - 1) + c). */
export const CURVE_CONSTANTS: Record<CurveType, { k: number; alpha: number; c: number }> = {
  definite: { k: 0, alpha: 1, c: 0 },
  'iec-standard-inverse': { k: 0.14, alpha: 0.02, c: 0 },
  'iec-very-inverse': { k: 13.5, alpha: 1, c: 0 },
  'iec-extremely-inverse': { k: 80, alpha: 2, c: 0 },
}

/** Relay sensing + processing latency before a trip decision (ms, ~1.5 cycles). */
export const RELAY_PROCESSING_MS = 25

/** Minimum separation used in the force law to avoid a singularity near contact (m). */
export const D_MIN_M = 0.02

// ---- Simulation integration ----
/** Fixed integration / sampling step (ms). */
export const SIM_DT_MS = 3
/** Total simulated horizon (ms) — long enough for several multi-second reclose shots. */
export const SIM_HORIZON_MS = 16000
/** Brief healthy period shown before the initial fault (ms). */
export const FAULT_START_MS = 150
/** Extra time simulated after a terminal state (RESTORED/LOCKOUT) to show settling (ms). */
export const TERMINAL_TAIL_MS = 2600
/**
 * When protection is disabled (or never trips), the fault stays energized this long
 * before a single slow clearing — dramatizing "Scenario A" (no/slow protection).
 */
export const NO_PROTECTION_CLEAR_MS = 1500

// ---- EDUCATIONAL mechanical tuning (calibrated, not field data) ----
/**
 * Scales the lumped midspan driving force. Folds in mode shape and the fraction of the
 * distributed magnetic force seen by the center-of-span lumped mass. Calibrated so the
 * default 7.5 kA AB scenario reaches slap territory under slow clearing.
 */
export const EDU_FORCE_GAIN = 0.4
/** Fraction of total span mass attributed to the lumped midspan oscillator. */
export const MASS_FRACTION = 0.5
/** Light viscous damping ratio so post-clear swing persists for a few seconds. */
export const DAMPING_RATIO = 0.045
/** Reference swing (pendulum) period at the reference sag (s). */
export const SWING_PERIOD_REF_S = 1.0
/** Reference sag the swing period is normalized to (ft). Period ~ sqrt(sag). */
export const SAG_REF_FT = 5
/** Reference span the swing period is normalized to (ft). Longer spans swing more. */
export const SPAN_REF_FT = 250
/** Clamp on the swing period to keep the model well-behaved (s). */
export const SWING_PERIOD_MIN_S = 0.55
export const SWING_PERIOD_MAX_S = 1.8

/**
 * Extra clearance margin (ft) added to the conductor diameter when deciding a "slap".
 * Lets the visualization register a teaching slap slightly before literal metal-to-metal
 * contact (flashover bridges the final small gap on a re-energized circuit).
 */
export const CONTACT_VISUAL_SAFETY_FT = 0.25
/** Clearance band (ft, above the contact threshold) flagged as a "near miss". */
export const NEAR_MISS_BAND_FT = 1.0
