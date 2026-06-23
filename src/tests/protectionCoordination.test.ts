import { describe, it, expect } from 'vitest'
import { runSimulation } from '@/simulation/runSimulation'
import { relayDecisionMs, clearTimeMs } from '@/simulation/protection'
import { shotConfig } from '@/simulation/recloserSequence'
import { RELAY_PROCESSING_MS } from '@/simulation/constants'
import {
  DEFAULT_SCENARIO,
  DEFAULT_SUBSTATION_RELAY,
  RECORDED_EVENT_RECLOSER,
  PRESETS,
} from '@/state/presets'

/**
 * EVENT-DATA GATE.
 *
 * Reproduces the recorded 3140 A line-to-line fault downstream of the recloser:
 *   - recloser phase TOC operates in ~0.5 s,
 *   - the substation relay does NOT operate (recloser clears first; relay resets),
 *   - the first reclose into the still-persistent fault re-trips instantaneously.
 * If these fail, the protection curves / device settings have drifted from the field event.
 */
describe('two-device coordination — recorded 3140 A event', () => {
  const I = 3140

  it('recloser TOC (US EI, TD 0.80) operates in ~0.5 s', () => {
    const op1 = shotConfig(RECORDED_EVENT_RECLOSER, 0)
    expect(op1.curveMode).toBe('inverse') // first operation rides the time curve
    const decision = relayDecisionMs(I, RECORDED_EVENT_RECLOSER, op1.curveMode)
    expect(decision).not.toBeNull()
    expect(decision! / 1000).toBeCloseTo(0.434, 2)
    expect(clearTimeMs(decision!, RECORDED_EVENT_RECLOSER) / 1000).toBeLessThan(0.55)
  })

  it('substation relay is slower and resets — it does not operate', () => {
    const relayDecision = relayDecisionMs(I, DEFAULT_SUBSTATION_RELAY, 'inverse')!
    const recloserClear = clearTimeMs(
      relayDecisionMs(I, RECORDED_EVENT_RECLOSER, 'inverse')!,
      RECORDED_EVENT_RECLOSER,
    )
    expect(relayDecision / 1000).toBeCloseTo(0.814, 2)
    // The recloser clears well before the relay would reach its operate time → relay resets.
    expect(relayDecision).toBeGreaterThan(recloserClear)
  })

  it('first reclose into the persistent fault re-trips instantaneously', () => {
    const op2 = shotConfig(RECORDED_EVENT_RECLOSER, 1)
    expect(op2.curveMode).toBe('instantaneous')
    // 3140 A is above the recloser's reclose-armed instantaneous pickup (2500 A) → fast trip.
    expect(relayDecisionMs(I, RECORDED_EVENT_RECLOSER, 'instantaneous')).toBe(RELAY_PROCESSING_MS)
  })

  it('full run of the recorded-event preset: TOC trip ~0.5 s, persists, sequences to lockout', () => {
    const preset = PRESETS.find((p) => p.id === 'recorded-event')!
    const r = runSimulation(preset.scenario)
    expect(r.tripTimeMs! / 1000).toBeCloseTo(0.434, 1) // first (TOC) trip
    expect(r.numTrips).toBe(RECORDED_EVENT_RECLOSER.shotsToLockout)
    expect(r.finalState).toBe('LOCKOUT')
  })
})

describe('two-device coordination — fault location routing', () => {
  it('a downstream fault is cleared by the recloser (faster device)', () => {
    const r = runSimulation({
      ...DEFAULT_SCENARIO,
      faultLocation: 'downstream',
      faultCurrentA: 3140,
      faultPersists: true,
      protection: RECORDED_EVENT_RECLOSER,
    })
    // Operating device = recloser → first trip on its TOC ~0.43 s.
    expect(r.tripTimeMs! / 1000).toBeCloseTo(0.434, 1)
  })

  it('an upstream fault is cleared by the substation relay (no current through recloser)', () => {
    const r = runSimulation({
      ...DEFAULT_SCENARIO,
      faultLocation: 'upstream',
      faultCurrentA: 3140,
      faultPersists: true,
    })
    // Operating device = substation relay (TD 1.50) → first trip ~0.81 s.
    expect(r.tripTimeMs! / 1000).toBeCloseTo(0.814, 1)
  })
})

describe('two-device coordination — split energization', () => {
  it('keeps the upstream section energized while the recloser is open (downstream fault)', () => {
    const r = runSimulation({
      ...DEFAULT_SCENARIO,
      faultCurrentA: 3140,
      faultLocation: 'downstream',
      protection: RECORDED_EVENT_RECLOSER,
      faultPersists: true,
    })
    // There must be frames where the recloser (downstream) is open but the substation breaker
    // keeps the upstream section live.
    const reclOpenButUpstreamLive = r.frames.filter((f) => !f.energized && f.upstreamEnergized)
    expect(reclOpenButUpstreamLive.length).toBeGreaterThan(0)
    // After lockout the downstream stays dead but the source side remains energized.
    const last = r.frames[r.frames.length - 1]
    expect(last.energized).toBe(false)
    expect(last.upstreamEnergized).toBe(true)
  })

  it('de-energizes the whole line together when protection is disabled', () => {
    const r = runSimulation({ ...DEFAULT_SCENARIO, protectionEnabled: false })
    // No device separation: upstream tracks the (single) energized state, never diverges.
    expect(r.frames.every((f) => f.upstreamEnergized === f.energized)).toBe(true)
  })
})

describe('fault-sim — deterministic reclose outcome', () => {
  it('restores service on the chosen reclose attempt', () => {
    for (const attempt of [1, 2, 3]) {
      const r = runSimulation({
        ...DEFAULT_SCENARIO,
        faultCurrentA: 3140,
        faultLocation: 'downstream',
        protection: RECORDED_EVENT_RECLOSER,
        restoreOnReclose: attempt,
      })
      // Re-strike on earlier attempts, restore on the chosen one → exactly `attempt` trips.
      expect(r.numTrips).toBe(attempt)
      expect(r.finalState).toBe('RESTORED')
    }
  })
})
