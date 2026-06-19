/**
 * Magnetic force between parallel conductors.
 *
 * For two long parallel conductors carrying currents I1 and I2 separated by distance d:
 *
 *     F / L = mu0 * I1 * I2 / (2 * pi * d)
 *
 * The key teaching point is that force scales with the PRODUCT of currents — for a
 * line-to-line fault where the same fault current flows out one phase and back the
 * other, F/L ∝ I^2. Going from 1 kA to 10 kA is ~100x the force, not 10x.
 *
 * In a line-to-line fault the two currents are antiparallel, so the force is REPULSIVE:
 * the conductors are pushed apart while the fault is energized. The slap then tends to
 * occur as they swing back together after the fault clears.
 */
import { MU_0, D_MIN_M } from './constants'

/**
 * Force per unit length (N/m) between two parallel conductors.
 * @param currentA1 current magnitude in conductor 1 (A)
 * @param currentA2 current magnitude in conductor 2 (A)
 * @param distanceM center-to-center separation (m); clamped to D_MIN_M to avoid a singularity
 */
export function forcePerLengthNPerM(
  currentA1: number,
  currentA2: number,
  distanceM: number,
): number {
  const d = Math.max(Math.abs(distanceM), D_MIN_M)
  return (MU_0 * currentA1 * currentA2) / (2 * Math.PI * d)
}

/**
 * Convenience for a two-conductor line-to-line fault: the same fault current flows in
 * both conductors, so F/L = mu0 * I^2 / (2*pi*d).
 */
export function faultForcePerLengthNPerM(faultCurrentA: number, separationM: number): number {
  return forcePerLengthNPerM(faultCurrentA, faultCurrentA, separationM)
}

/**
 * Pairwise repulsive force per length between two phases at given lateral positions,
 * returned as a signed force on `posM1` along the lateral axis (positive = +axis).
 * Antiparallel fault currents repel, so each conductor is pushed AWAY from the other.
 */
export function lateralRepulsionNPerM(
  currentA: number,
  posM1: number,
  posM2: number,
): number {
  const delta = posM1 - posM2
  const dist = Math.max(Math.abs(delta), D_MIN_M)
  const mag = forcePerLengthNPerM(currentA, currentA, dist)
  // push conductor 1 away from conductor 2
  const dir = delta === 0 ? 1 : Math.sign(delta)
  return mag * dir
}
