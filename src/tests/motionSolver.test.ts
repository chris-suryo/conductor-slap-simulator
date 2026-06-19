import { describe, it, expect } from 'vitest'
import { computeMechParams, stepOscillator } from '@/simulation/motionSolver'
import { getConductor } from '@/simulation/conductorCatalog'
import { DEFAULT_SCENARIO } from '@/state/presets'
import { SWING_PERIOD_MAX_S, SWING_PERIOD_MIN_S } from '@/simulation/constants'

const conductor = getConductor(DEFAULT_SCENARIO.conductorTypeId)

describe('motionSolver — mechanical parameters', () => {
  it('produces positive, finite mechanical parameters', () => {
    const mp = computeMechParams(DEFAULT_SCENARIO, conductor)
    expect(mp.massEffKg).toBeGreaterThan(0)
    expect(mp.stiffness).toBeGreaterThan(0)
    expect(mp.damping).toBeGreaterThan(0)
    expect(mp.omega0).toBeGreaterThan(0)
  })

  it('keeps the swing period within the configured clamp', () => {
    const mp = computeMechParams(DEFAULT_SCENARIO, conductor)
    expect(mp.swingPeriodS).toBeGreaterThanOrEqual(SWING_PERIOD_MIN_S)
    expect(mp.swingPeriodS).toBeLessThanOrEqual(SWING_PERIOD_MAX_S)
  })

  it('gives a longer swing period for larger sag', () => {
    const small = computeMechParams({ ...DEFAULT_SCENARIO, sagFt: 3 }, conductor)
    const large = computeMechParams({ ...DEFAULT_SCENARIO, sagFt: 8 }, conductor)
    expect(large.swingPeriodS).toBeGreaterThan(small.swingPeriodS)
  })
})

describe('motionSolver — integration', () => {
  it('moves in the direction of an applied force', () => {
    const mp = computeMechParams(DEFAULT_SCENARIO, conductor)
    let s = { x: 0, v: 0 }
    s = stepOscillator(s, 200, mp, 0.003)
    expect(s.v).toBeGreaterThan(0)
    expect(s.x).toBeGreaterThan(0)
  })

  it('dissipates energy under damping when released', () => {
    const mp = computeMechParams(DEFAULT_SCENARIO, conductor)
    let s = { x: 0.5, v: 0 }
    const energy = (st: { x: number; v: number }) => st.x * st.x + (st.v / mp.omega0) ** 2
    const e0 = energy(s)
    for (let i = 0; i < 1500; i++) s = stepOscillator(s, 0, mp, 0.003)
    expect(energy(s)).toBeLessThan(e0)
  })
})
