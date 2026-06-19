import { describe, it, expect } from 'vitest'
import {
  inverseTripTimeMs,
  relayDecisionMs,
  autoRelayDecisionMs,
  clearTimeMs,
} from '@/simulation/protection'
import { RELAY_PROCESSING_MS } from '@/simulation/constants'
import { DEFAULT_PROTECTION } from '@/state/presets'

describe('protection — inverse curves', () => {
  it('returns Infinity when current does not exceed pickup', () => {
    expect(inverseTripTimeMs(500, 600, 'iec-very-inverse', 1)).toBe(Infinity)
    expect(inverseTripTimeMs(600, 600, 'iec-very-inverse', 1)).toBe(Infinity)
  })

  it('computes IEC very-inverse time: t = TMS * 13.5 / (M - 1)', () => {
    // M = 2 -> 13.5 / (2-1) = 13.5 s
    expect(inverseTripTimeMs(1200, 600, 'iec-very-inverse', 1)).toBeCloseTo(13500, 0)
    // TMS scales linearly
    expect(inverseTripTimeMs(1200, 600, 'iec-very-inverse', 0.5)).toBeCloseTo(6750, 0)
  })

  it('higher multiples of pickup trip faster', () => {
    const slow = inverseTripTimeMs(1200, 600, 'iec-very-inverse', 1) // M=2
    const fast = inverseTripTimeMs(6000, 600, 'iec-very-inverse', 1) // M=10
    expect(fast).toBeLessThan(slow)
  })

  it('extremely-inverse clears faster than standard-inverse at high fault multiples', () => {
    // The IEC curves cross: extremely-inverse is steeper, so it is faster only at
    // high multiples of pickup (here M = 20).
    const standard = inverseTripTimeMs(12000, 600, 'iec-standard-inverse', 1)
    const extreme = inverseTripTimeMs(12000, 600, 'iec-extremely-inverse', 1)
    expect(extreme).toBeLessThan(standard)
  })
})

describe('protection — trip decision', () => {
  it('trips instantaneously above the instantaneous pickup', () => {
    const t = relayDecisionMs(7500, DEFAULT_PROTECTION, 'instantaneous')
    expect(t).toBe(RELAY_PROCESSING_MS)
  })

  it('does not trip below pickup', () => {
    const low = { ...DEFAULT_PROTECTION, phasePickupA: 600 }
    expect(relayDecisionMs(500, low, 'inverse')).toBeNull()
    expect(autoRelayDecisionMs(500, low)).toBeNull()
  })

  it('rides the inverse curve below the instantaneous pickup', () => {
    // 3000 A: below 6000 A instantaneous pickup, above 600 A pickup
    const t = autoRelayDecisionMs(3000, DEFAULT_PROTECTION)
    expect(t).not.toBeNull()
    expect(t!).toBeGreaterThan(RELAY_PROCESSING_MS)
  })

  it('definite mode returns the fixed delay above pickup', () => {
    const t = relayDecisionMs(3000, { ...DEFAULT_PROTECTION, definiteTimeMs: 180 }, 'definite')
    expect(t).toBe(180)
  })

  it('adds breaker operating time to the clearing time', () => {
    expect(clearTimeMs(25, DEFAULT_PROTECTION)).toBe(25 + DEFAULT_PROTECTION.breakerOpenTimeMs)
  })
})
