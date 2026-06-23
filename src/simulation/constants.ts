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

/**
 * Nominal feeder load current (A) shown in the live readout when the line is energized but not
 * faulting — so the demo reads as a live circuit carrying load rather than a blank/dash.
 * Educational placeholder, not a measured value.
 */
export const NOMINAL_LOAD_CURRENT_A = 200

/**
 * Reduced feeder load current (A) carried by the upstream section (through the substation breaker)
 * once the recloser has opened and shed the downstream load. Educational placeholder.
 */
export const REDUCED_LOAD_CURRENT_A = 100

/**
 * Load current (A) assumed in the UNFAULTED phase during a line-to-line fault. It sets the much
 * smaller magnetic interaction between that phase and the two faulted conductors (force scales
 * with I_load * I_fault, not I_fault^2).
 */
export const UNFAULTED_PHASE_CURRENT_A = 200

/**
 * De-rating factor (0..1) on the unfaulted-phase force. The coherent (time-averaged) force depends
 * on the phase angle between the load current and the fault current (~cos phi), which the steady-
 * RMS model can't resolve — so the in-phase estimate is scaled down. Pure educational knob: raise
 * it to make the unfaulted-phase sway more visible, lower it to mute it.
 */
export const UNFAULTED_COUPLING = 0.3

/**
 * Inverse-curve constants for `t = (TMS|TD) * (k / (M^alpha - 1) + c)`, with `M = I / pickup`.
 *
 * IEC 60255 curves use `c = 0`. The SEL "US" curves (U1–U5) map onto the SAME algebraic form
 * with `c = A`, `k = B`, `alpha = P` from SEL's operate-time equation `t = TD*(A + B/(M^P − 1))`.
 * These are SEL's own US curves (much faster than textbook IEEE C37.112) — the ones the field
 * recloser/relay controls actually run. See docs/ENGINEERING_NOTES.md for the validation.
 */
export const CURVE_CONSTANTS: Record<CurveType, { k: number; alpha: number; c: number }> = {
  definite: { k: 0, alpha: 1, c: 0 },
  'iec-standard-inverse': { k: 0.14, alpha: 0.02, c: 0 },
  'iec-very-inverse': { k: 13.5, alpha: 1, c: 0 },
  'iec-extremely-inverse': { k: 80, alpha: 2, c: 0 },
  // SEL US curves (c=A, k=B, alpha=P).
  'us-moderately-inverse': { k: 0.0104, alpha: 0.02, c: 0.0226 },
  'us-inverse': { k: 5.95, alpha: 2.0, c: 0.18 },
  'us-very-inverse': { k: 3.88, alpha: 2.0, c: 0.0963 },
  'us-extremely-inverse': { k: 5.67, alpha: 2.0, c: 0.0352 },
  'us-short-time-inverse': { k: 0.00342, alpha: 0.02, c: 0.00262 },
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
 * default 7.5 kA AB scenario reaches slap territory under slow clearing while the fast-
 * protected case stays well clear. NOTE: this is a pure calibration knob, not the textbook
 * modal projection (~2/π ≈ 0.64) — with the sag-physical swing period the displacement
 * scales ~T², so a modal-magnitude gain would over-swing wildly. Re-tune (see
 * src/tests/runSimulation.test.ts) if you change the period model.
 */
export const EDU_FORCE_GAIN = 0.15
/** Fraction of total span mass attributed to the lumped midspan oscillator. */
export const MASS_FRACTION = 0.5
/** Light viscous damping ratio so post-clear swing persists for a few seconds. */
export const DAMPING_RATIO = 0.045
/**
 * Reference transverse-swing period at the reference sag (s). A conductor's lateral swing
 * behaves as a physical pendulum whose period depends on SAG ALONE: f1 = 0.55/sqrt(sag_m),
 * i.e. T ≈ sqrt(sag_ft). At SAG_REF_FT = 5 ft that is ≈ sqrt(5) ≈ 2.24 s.
 */
export const SWING_PERIOD_REF_S = 2.24
/** Reference sag the swing period is normalized to (ft). Period ~ sqrt(sag). */
export const SAG_REF_FT = 5
/**
 * Anchor span (ft) at which the scenario `sagFt` is taken. Sag grows with span at fixed
 * stringing tension (parabola D = w*L^2 / 8H, so sag ∝ span^2), which is how longer spans
 * end up swinging more — see motionSolver.computeMechParams.
 */
export const SPAN_REF_FT = 250
/** Clamp on the swing period to keep the model well-behaved (s). */
export const SWING_PERIOD_MIN_S = 0.8
export const SWING_PERIOD_MAX_S = 4.5

/**
 * Extra clearance margin (ft) added to the conductor diameter when deciding a "slap".
 * Lets the visualization register a teaching slap slightly before literal metal-to-metal
 * contact (flashover bridges the final small gap on a re-energized circuit).
 */
export const CONTACT_VISUAL_SAFETY_FT = 0.25
/** Clearance band (ft, above the contact threshold) flagged as a "near miss". */
export const NEAR_MISS_BAND_FT = 1.0
