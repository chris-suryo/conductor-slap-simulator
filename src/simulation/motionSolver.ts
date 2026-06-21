/**
 * Simplified center-span conductor motion: a lumped spring-mass-damper oscillator per
 * phase, integrated with semi-implicit (symplectic) Euler.
 *
 *     m * x'' + c * x' + k * x = F(t)
 *
 * where x is the lateral displacement of the conductor midspan from its rest position.
 *  - m  : effective midspan mass (from conductor unit weight, span, and a mode fraction)
 *  - k  : effective restoring stiffness, derived from a sag-dependent swing period
 *  - c  : light viscous damping so the post-clear swing persists for a few seconds
 *  - F  : lateral magnetic force during the energized fault (zero once cleared)
 *
 * This is a teaching abstraction of full catenary dynamics, tuned for clear animation
 * and intuition rather than mechanical accuracy.
 */
import type { ConductorType, Scenario } from './types'
import {
  DAMPING_RATIO,
  MASS_FRACTION,
  SAG_REF_FT,
  SPAN_REF_FT,
  SWING_PERIOD_MAX_S,
  SWING_PERIOD_MIN_S,
  SWING_PERIOD_REF_S,
} from './constants'
import { ftToM, lbPerKftToKgPerM } from './units'

export interface MechParams {
  /** Effective lumped midspan mass (kg). */
  massEffKg: number
  /** Restoring stiffness k (N/m). */
  stiffness: number
  /** Viscous damping coefficient c (N·s/m). */
  damping: number
  /** Undamped natural angular frequency (rad/s). */
  omega0: number
  /** Mechanical swing period (s). */
  swingPeriodS: number
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Derive the mechanical oscillator parameters from the scenario + conductor. */
export function computeMechParams(scenario: Scenario, conductor: ConductorType): MechParams {
  const spanM = ftToM(scenario.spanLengthFt)
  const massPerM = lbPerKftToKgPerM(conductor.weightLbPerKft)
  const massEffKg = Math.max(massPerM * spanM * MASS_FRACTION, 0.5)

  // Span influences the swing through SAG, not through the period directly. At a fixed
  // stringing tension the sag follows the parabola D = w*L^2 / (8H), so sag ∝ span^2; the
  // scenario `sagFt` is taken at the reference/anchor span (SPAN_REF_FT) and longer spans
  // are strung with more sag. (In the lumped model span otherwise cancels out of F/m, so
  // routing it through sag is the physically honest way long spans end up swinging more.)
  const effectiveSagFt = Math.max(scenario.sagFt, 0.5) * (scenario.spanLengthFt / SPAN_REF_FT) ** 2

  // A conductor's transverse swing behaves as a physical pendulum whose period depends on
  // SAG ALONE: the fundamental frequency f1 = 0.55 / sqrt(sag_m), i.e. T ≈ sqrt(sag_ft)
  // seconds, independent of span length, tension, and mass. SWING_PERIOD_REF_S is that
  // period at the reference sag (≈ sqrt(SAG_REF_FT)).
  const swingPeriodS = clamp(
    SWING_PERIOD_REF_S * Math.sqrt(effectiveSagFt / SAG_REF_FT),
    SWING_PERIOD_MIN_S,
    SWING_PERIOD_MAX_S,
  )
  const omega0 = (2 * Math.PI) / swingPeriodS
  const stiffness = massEffKg * omega0 * omega0
  const damping = 2 * DAMPING_RATIO * omega0 * massEffKg

  return { massEffKg, stiffness, damping, omega0, swingPeriodS }
}

export interface OscillatorState {
  /** Displacement from rest (m). */
  x: number
  /** Velocity (m/s). */
  v: number
}

/**
 * Advance one oscillator by dt using semi-implicit Euler (update velocity, then
 * position with the new velocity — stable and energy-friendly for our step size).
 */
export function stepOscillator(
  state: OscillatorState,
  forceN: number,
  mp: MechParams,
  dtS: number,
): OscillatorState {
  const accel = (forceN - mp.damping * state.v - mp.stiffness * state.x) / mp.massEffKg
  const v = state.v + accel * dtS
  const x = state.x + v * dtS
  return { x, v }
}
