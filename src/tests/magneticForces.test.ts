import { describe, it, expect } from 'vitest'
import {
  forcePerLengthNPerM,
  faultForcePerLengthNPerM,
  lateralRepulsionNPerM,
} from '@/simulation/magneticForces'
import { MU_0 } from '@/simulation/constants'

describe('magneticForces', () => {
  it('matches the analytic F/L = mu0 * I1 * I2 / (2*pi*d)', () => {
    const I1 = 7500
    const I2 = 7500
    const d = 1.067 // ~3.5 ft in meters
    const expected = (MU_0 * I1 * I2) / (2 * Math.PI * d)
    expect(forcePerLengthNPerM(I1, I2, d)).toBeCloseTo(expected, 9)
    // ~10.5 N/m sanity check
    expect(forcePerLengthNPerM(I1, I2, d)).toBeCloseTo(10.5, 1)
  })

  it('scales with the product of currents (I^2 for an L-L fault)', () => {
    const d = 1
    const base = faultForcePerLengthNPerM(1000, d)
    const tenX = faultForcePerLengthNPerM(10000, d)
    // 10x current -> ~100x force, not 10x
    expect(tenX / base).toBeCloseTo(100, 5)
  })

  it('scales inversely with separation (1/d)', () => {
    const f1 = forcePerLengthNPerM(5000, 5000, 1)
    const f2 = forcePerLengthNPerM(5000, 5000, 2)
    expect(f1 / f2).toBeCloseTo(2, 6)
  })

  it('clamps near-zero separation to avoid a singularity', () => {
    const f = forcePerLengthNPerM(5000, 5000, 0)
    expect(Number.isFinite(f)).toBe(true)
    expect(f).toBeGreaterThan(0)
  })

  it('produces repulsion that pushes each conductor away from the other', () => {
    // conductor 1 to the left (negative), conductor 2 to the right (positive)
    const onLeft = lateralRepulsionNPerM(5000, -1.75, 1.75)
    const onRight = lateralRepulsionNPerM(5000, 1.75, -1.75)
    expect(onLeft).toBeLessThan(0) // pushed further left
    expect(onRight).toBeGreaterThan(0) // pushed further right
    expect(onLeft).toBeCloseTo(-onRight, 6)
  })
})
