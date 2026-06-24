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

describe('runSimulation — line-to-ground faults (AG/BG/CG)', () => {
  it.each(['AG', 'BG', 'CG'] as const)('%s: protection still clears the fault on its curve', (faultType) => {
    const r = runSimulation({ ...DEFAULT_SCENARIO, faultType })
    expect(r.numTrips).toBeGreaterThanOrEqual(1)
    expect(r.tripTimeMs).not.toBeNull()
    expect(r.finalState).toBe('RESTORED')
  })

  it.each([
    ['AG', 'A'] as const,
    ['BG', 'B'] as const,
    ['CG', 'C'] as const,
  ])('%s: no pairwise repulsion on the faulted conductor itself, so it never slaps', (faultType, faultedPhase) => {
    // No protection so the fault rides through for a while — if a ground fault produced a
    // pairwise force the way a line-to-line one does, this would swing and could slap. There's
    // no second high-current conductor to repel against, so the faulted phase itself doesn't
    // move and there's no "pair" force — but the two healthy phases DO feel a small coupling
    // force from sitting in the faulted phase's field (same mechanism as the unfaulted phase in
    // an L-L fault), so they pick up a tiny, much smaller displacement.
    const r = runSimulation({ ...NO_PROTECTION_SCENARIO, faultType })
    const faultedDisp = faultedPhase === 'A' ? 'dispAFt' : faultedPhase === 'B' ? 'dispBFt' : 'dispCFt'
    let maxHealthyDisp = 0
    for (const f of r.frames) {
      expect(f[faultedDisp]).toBe(0)
      expect(f.forcePerLenNPerM).toBe(0) // no faulted PAIR, so this metric stays 0
      for (const ph of ['A', 'B', 'C'] as const) {
        if (ph === faultedPhase) continue
        const key = ph === 'A' ? 'dispAFt' : ph === 'B' ? 'dispBFt' : 'dispCFt'
        maxHealthyDisp = Math.max(maxHealthyDisp, Math.abs(f[key]))
      }
    }
    // Nonzero (physically honest coupling) but small — nowhere near slap range (it's a much
    // weaker source than a faulted PAIR, so it stays well under the clearance threshold).
    expect(maxHealthyDisp).toBeGreaterThan(0)
    expect(maxHealthyDisp).toBeLessThan(r.contactThresholdFt)
    expect(r.slapOccurred).toBe(false)
  })

  it('the recloser single-pole trips a ground fault: the 2 healthy phases never lose power', () => {
    const r = runSimulation({ ...DEFAULT_SCENARIO, faultType: 'AG' })
    expect(r.singlePoleTrip).toBe(true)
    // The faulted pole DOES open during the trip — `energized` still tracks it accurately.
    expect(r.frames.some((f) => !f.energized)).toBe(true)
    // But the 2 healthy phases are never interrupted, for every frame in the run.
    expect(r.frames.every((f) => f.downstreamHealthyEnergized)).toBe(true)
  })

  it('a persistent AG fault: shots 1–3 single-pole, but the final (lockout) shot converts to three-pole', () => {
    // Force every reclose to re-strike so the recloser sequences all the way to lockout
    // (DEFAULT_SCENARIO's recloser is configured for shotsToLockout: 4 — 3 reclose attempts).
    const r = runSimulation({ ...DEFAULT_SCENARIO, faultType: 'AG', faultPersists: true })
    expect(r.finalState).toBe('LOCKOUT')
    expect(r.numTrips).toBe(4)

    const earlyOpenFrames = r.frames.filter((f) => f.shot > 0 && f.shot < 4 && !f.energized)
    const finalOpenFrames = r.frames.filter((f) => f.shot === 4 && !f.energized)
    expect(earlyOpenFrames.length).toBeGreaterThan(0)
    expect(finalOpenFrames.length).toBeGreaterThan(0)

    // Shots 1–3: the faulted pole opens, but the 2 healthy phases stay energized (single-pole).
    expect(earlyOpenFrames.every((f) => f.downstreamHealthyEnergized)).toBe(true)
    // The 4th (lockout) shot converts to three-pole: the healthy phases drop too this time.
    expect(finalOpenFrames.every((f) => !f.downstreamHealthyEnergized)).toBe(true)
  })

  it('a line-to-line fault is NOT single-pole trippable (all 3 poles trip together)', () => {
    const r = runSimulation({ ...DEFAULT_SCENARIO, faultType: 'AB' })
    expect(r.singlePoleTrip).toBe(false)
    // Without single-pole capability, "healthy" energization just mirrors the device state.
    expect(r.frames.every((f) => f.downstreamHealthyEnergized === f.energized)).toBe(true)
  })

  it('a ground fault routed to the substation relay (recloser disabled) trips all 3 poles', () => {
    // The substation breaker has no single-pole capability — only the RECLOSER does.
    const r = runSimulation({ ...DEFAULT_SCENARIO, faultType: 'AG', protectionEnabled: false })
    expect(r.singlePoleTrip).toBe(false)
    expect(r.frames.every((f) => f.downstreamHealthyEnergized === f.energized)).toBe(true)
  })
})
