import { describe, it, expect } from 'vitest'
import {
  shotConfig,
  isLockout,
  recloseOutcome,
  ProtectionController,
} from '@/simulation/recloserSequence'
import { DEFAULT_PROTECTION } from '@/state/presets'

describe('recloserSequence — pure helpers', () => {
  it('resolves shot configuration from settings', () => {
    // Default recloser: first operation rides the TOC curve; open interval = 12 cycles (200 ms).
    expect(shotConfig(DEFAULT_PROTECTION, 0)).toEqual({
      curveMode: 'inverse',
      recloseDelayMs: 200,
    })
    expect(shotConfig(DEFAULT_PROTECTION, 1).curveMode).toBe('inverse')
  })

  it('falls back sensibly beyond the configured shots', () => {
    const cfg = shotConfig({ ...DEFAULT_PROTECTION, recloseShots: [] }, 0)
    expect(cfg.curveMode).toBe('instantaneous')
    expect(cfg.recloseDelayMs).toBeGreaterThan(0)
  })

  it('locks out when the trip number reaches shots-to-lockout', () => {
    expect(isLockout(2, 3)).toBe(false)
    expect(isLockout(3, 3)).toBe(true)
    expect(isLockout(4, 3)).toBe(true)
  })

  it('restores when clear, re-strikes when still close', () => {
    expect(recloseOutcome(2.0, 0.3)).toBe('restore')
    expect(recloseOutcome(0.1, 0.3)).toBe('restrike')
  })
})

describe('recloserSequence — controller FSM', () => {
  it('runs NORMAL -> fault -> trip -> open -> reclose -> restored when clear', () => {
    const controller = new ProtectionController({
      protectionEnabled: true,
      faultCurrentA: 7500,
      settings: DEFAULT_PROTECTION,
      faultStartMs: 150,
    })

    // Feed a generous clearance so the reclose always restores.
    let restored = false
    for (let t = 0; t <= 4000; t += 3) {
      const snap = controller.step(t, 5.0, 0.3)
      if (snap.terminal && snap.terminalReason === 'restored') restored = true
    }

    expect(restored).toBe(true)
    const kinds = controller.events.map((e) => e.kind)
    expect(kinds).toContain('fault')
    expect(kinds).toContain('trip')
    expect(kinds).toContain('open')
    expect(kinds).toContain('reclose')
    expect(kinds).toContain('restored')
  })

  it('re-strikes and eventually locks out when conductors stay close', () => {
    const controller = new ProtectionController({
      protectionEnabled: true,
      faultCurrentA: 7500,
      settings: DEFAULT_PROTECTION,
      faultStartMs: 150,
    })

    // Always too close on reclose -> repeated re-strike -> lockout.
    let lockedOut = false
    for (let t = 0; t <= 20000; t += 3) {
      const snap = controller.step(t, 0.05, 0.3)
      if (snap.terminal && snap.terminalReason === 'lockout') lockedOut = true
    }

    expect(lockedOut).toBe(true)
    const trips = controller.events.filter((e) => e.kind === 'trip').length
    expect(trips).toBe(DEFAULT_PROTECTION.shotsToLockout)
  })
})
