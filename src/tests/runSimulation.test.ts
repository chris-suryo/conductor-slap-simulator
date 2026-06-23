import { describe, it, expect } from 'vitest'
import { runSimulation } from '@/simulation/runSimulation'
import { relayDecisionMs } from '@/simulation/protection'
import { DEFAULT_SCENARIO, DEFAULT_SUBSTATION_RELAY, PRESETS } from '@/state/presets'

// The "no protection" preset disables the recloser AND neutralizes the substation-relay backup
// (pickup far above the slider range) — a feeder with no working protection at all. Reuse it
// rather than re-deriving the same scenario inline so the two stay in sync.
const NO_PROTECTION_SCENARIO = PRESETS.find((p) => p.id === 'no-protection')!.scenario

/**
 * CALIBRATION / STORY GATE.
 *
 * The whole demo hinges on a single contrast: with fast protection the conductors do
 * NOT slap and the reclose restores service; with no/slow protection they DO slap.
 * If these expectations fail, retune the educational constants in constants.ts
 * (EDU_FORCE_GAIN, SWING_PERIOD_REF_S, DAMPING_RATIO, CONTACT_VISUAL_SAFETY_FT).
 */
describe('runSimulation — calibration / teaching story', () => {
  it('produces a populated, monotonically-timed frame series', () => {
    const r = runSimulation(DEFAULT_SCENARIO)
    expect(r.frames.length).toBeGreaterThan(100)
    expect(r.frames[0].tMs).toBe(0)
    for (let i = 1; i < r.frames.length; i++) {
      expect(r.frames[i].tMs).toBeGreaterThan(r.frames[i - 1].tMs)
    }
  })

  it('PROTECTED default: fast trip, no slap, successful reclose', () => {
    const r = runSimulation(DEFAULT_SCENARIO)
    expect(r.numTrips).toBeGreaterThanOrEqual(1)
    expect(r.tripTimeMs).not.toBeNull()
    expect(r.tripTimeMs!).toBeLessThan(120) // instantaneous + breaker
    expect(r.slapOccurred).toBe(false)
    expect(r.finalState).toBe('RESTORED')
  })

  it('NO protection: large swing and a conductor slap', () => {
    const r = runSimulation(NO_PROTECTION_SCENARIO)
    expect(r.slapOccurred).toBe(true)
    expect(r.finalState).toBe('SLAP_FAULT')
    expect(r.numTrips).toBe(0)
  })

  it('clears LESS and swings MORE without protection than with it', () => {
    const protectedRun = runSimulation(DEFAULT_SCENARIO)
    const unprotectedRun = runSimulation(NO_PROTECTION_SCENARIO)
    expect(unprotectedRun.maxDisplacementFt).toBeGreaterThan(protectedRun.maxDisplacementFt)
    expect(unprotectedRun.minClearanceFt).toBeLessThan(protectedRun.minClearanceFt)
  })

  it('the unfaulted phase also sways, but much less than the faulted phases', () => {
    // A–B fault → C is the unfaulted phase. It carries load current and feels the faulted field.
    const r = runSimulation({ ...NO_PROTECTION_SCENARIO, faultType: 'AB' })
    let maxFaulted = 0
    let maxUnfaulted = 0
    for (const f of r.frames) {
      maxFaulted = Math.max(maxFaulted, Math.abs(f.dispAFt), Math.abs(f.dispBFt))
      maxUnfaulted = Math.max(maxUnfaulted, Math.abs(f.dispCFt))
    }
    expect(maxUnfaulted).toBeGreaterThan(0) // it moves
    expect(maxUnfaulted).toBeLessThan(maxFaulted * 0.6) // but clearly subordinate to the faulted pair
  })

})

describe('runSimulation — recloser disable routes to the substation relay backup', () => {
  it('disabling the recloser controller does NOT disable the substation relay', () => {
    // DEFAULT_SCENARIO's substation relay keeps its real field pickup/curve/TD here (unlike the
    // neutralized "no protection" preset) — so with the recloser off, the relay must still see
    // and clear the downstream fault on its own curve.
    const r = runSimulation({ ...DEFAULT_SCENARIO, protectionEnabled: false })
    const expectedMs = relayDecisionMs(
      DEFAULT_SCENARIO.faultCurrentA,
      DEFAULT_SUBSTATION_RELAY,
      'inverse',
    )!
    expect(r.numTrips).toBeGreaterThan(0)
    expect(r.tripTimeMs).not.toBeNull()
    expect(r.tripTimeMs! / 1000).toBeCloseTo(expectedMs / 1000, 2)
  })

  it('the whole line de-energizes together (no upstream/downstream split) when the relay clears it', () => {
    const r = runSimulation({ ...DEFAULT_SCENARIO, protectionEnabled: false })
    expect(r.frames.every((f) => f.upstreamEnergized === f.energized)).toBe(true)
  })

  it('an upstream fault always reaches the substation relay, even with the recloser "enabled"', () => {
    // The recloser enable toggle only affects downstream faults — it has no physical bearing on
    // an upstream fault, which never sees current through the recloser either way.
    const enabled = runSimulation({ ...DEFAULT_SCENARIO, faultLocation: 'upstream', protectionEnabled: true })
    const disabled = runSimulation({ ...DEFAULT_SCENARIO, faultLocation: 'upstream', protectionEnabled: false })
    expect(enabled.tripTimeMs).not.toBeNull()
    expect(disabled.tripTimeMs).not.toBeNull()
    expect(enabled.tripTimeMs! / 1000).toBeCloseTo(disabled.tripTimeMs! / 1000, 3)
  })
})
