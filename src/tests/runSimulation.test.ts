import { describe, it, expect } from 'vitest'
import { runSimulation } from '@/simulation/runSimulation'
import { DEFAULT_SCENARIO } from '@/state/presets'

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
    const r = runSimulation({ ...DEFAULT_SCENARIO, protectionEnabled: false })
    expect(r.slapOccurred).toBe(true)
    expect(r.finalState).toBe('SLAP_FAULT')
    expect(r.numTrips).toBe(0)
  })

  it('clears LESS and swings MORE without protection than with it', () => {
    const protectedRun = runSimulation(DEFAULT_SCENARIO)
    const unprotectedRun = runSimulation({ ...DEFAULT_SCENARIO, protectionEnabled: false })
    expect(unprotectedRun.maxDisplacementFt).toBeGreaterThan(protectedRun.maxDisplacementFt)
    expect(unprotectedRun.minClearanceFt).toBeLessThan(protectedRun.minClearanceFt)
  })
})
