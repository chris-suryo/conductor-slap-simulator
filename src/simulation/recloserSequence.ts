/**
 * Recloser / protection timeline state machine.
 *
 *   NORMAL -> FAULT_ACTIVE -> RELAY_TIMING -> TRIP_COMMAND -> BREAKER_OPENING
 *          -> DEAD_TIME -> RECLOSE -> (RESTORED | FAULT_ACTIVE again | LOCKOUT)
 *
 * Reclosers sense overcurrent, interrupt, reclose after a dead time, and lock out after
 * a preset number of operations (Eaton; NOJA). Here the "fault" that a reclose may
 * re-strike into is the conductor slap itself: if the conductors are still too close
 * when voltage is reapplied, an induced fault re-strikes and the device trips again.
 *
 * The FSM is time-driven; it is fed the live surface-to-surface clearance so the RECLOSE
 * decision (restore vs re-strike) is coupled to the conductor motion.
 */
import type {
  ProtectionSettings,
  ProtectionState,
  ShotCurveMode,
  TimelineEvent,
} from './types'
import { relayDecisionMs } from './protection'
import { NO_PROTECTION_CLEAR_MS } from './constants'

// ---- Pure decision helpers (unit-tested) ----

export interface ShotConfig {
  curveMode: ShotCurveMode
  /** Dead time after this operation's trip before the next reclose (ms). */
  recloseDelayMs: number
}

/** Resolve the curve mode + reclose delay for a 0-based operation index. */
export function shotConfig(settings: ProtectionSettings, shotIndex0: number): ShotConfig {
  const operation = shotIndex0 + 1
  const found = settings.recloseShots.find((s) => s.operation === operation)
  if (found) {
    return { curveMode: found.curveMode, recloseDelayMs: found.recloseDelayMs }
  }
  // Sensible fallback: fast first shot, then delayed inverse; growing dead times.
  const curveMode: ShotCurveMode = operation === 1 ? 'instantaneous' : 'inverse'
  const recloseDelayMs = operation === 1 ? 1000 : operation === 2 ? 5000 : 10000
  return { curveMode, recloseDelayMs }
}

/** A trip locks out when its 1-based number reaches the configured shots-to-lockout. */
export function isLockout(tripNumber: number, shotsToLockout: number): boolean {
  return tripNumber >= shotsToLockout
}

export type RecloseOutcome = 'restore' | 'restrike'

/**
 * On reclose: separated conductors restore service; still-close conductors re-strike.
 * A slap during the dead time means the conductors clashed (damaged / ionized path), so
 * reclosing into it re-strikes even if they have momentarily swung apart again.
 */
export function recloseOutcome(
  clearanceFt: number,
  thresholdFt: number,
  slappedDuringDeadTime = false,
): RecloseOutcome {
  if (slappedDuringDeadTime) return 'restrike'
  return clearanceFt > thresholdFt ? 'restore' : 'restrike'
}

// ---- Stateful controller driving the FSM over time ----

export type TerminalReason = 'restored' | 'lockout' | 'noclear'

export interface ProtectionSnapshot {
  state: ProtectionState
  energized: boolean
  faultActive: boolean
  /** 1-based operation in progress (0 = pre-fault normal). */
  shot: number
  terminal: boolean
  terminalReason: TerminalReason | null
}

const FAULT_ACTIVE_WINDOW_MS = 12

export interface ProtectionControllerOptions {
  protectionEnabled: boolean
  faultCurrentA: number
  settings: ProtectionSettings
  faultStartMs: number
  /** Energized duration before a single slow clearing when the relay never trips (ms). */
  noProtectionClearMs?: number
  /**
   * Genuine persistent fault: every reclose re-strikes regardless of conductor clearance, so the
   * device sequences to lockout. When false/undefined, the reclose outcome follows the conductor
   * clearance (slap mechanism).
   */
  faultPersists?: boolean
  /**
   * Deterministically restore on this reclose attempt (1-based): re-strike on earlier attempts,
   * restore on this one. Overrides `faultPersists` and the clearance-based outcome when set.
   */
  restoreOnReclose?: number
}

/**
 * Drives the protection FSM. Call `step(tMs, clearanceFt, thresholdFt)` on a monotonic
 * time grid; it returns the current snapshot and accumulates timeline events.
 */
export class ProtectionController {
  private readonly opts: ProtectionControllerOptions
  readonly events: TimelineEvent[] = []

  private shot = 0
  private faultPresent = false

  // Current energized-fault period schedule (absolute ms)
  private periodStart = 0
  private tripAtMs: number | null = null
  private clearAtMs = 0
  private recloseAtMs: number | null = null
  private willTrip = false
  private willLockout = false

  // Per-period event guards
  private emittedTrip = false
  private emittedOpen = false
  private emittedReclose = false

  private terminal = false
  private terminalReason: TerminalReason | null = null

  constructor(opts: ProtectionControllerOptions) {
    this.opts = opts
  }

  private push(
    tMs: number,
    state: ProtectionState,
    kind: TimelineEvent['kind'],
    label: string,
    detail?: string,
  ) {
    this.events.push({ tMs, state, kind, label, detail, shot: this.shot })
  }

  private beginFaultPeriod(t0: number, shotNum: number) {
    this.shot = shotNum
    this.faultPresent = true
    this.periodStart = t0
    this.emittedTrip = false
    this.emittedOpen = false
    this.emittedReclose = false

    const { protectionEnabled, faultCurrentA, settings } = this.opts
    const cfg = shotConfig(settings, shotNum - 1)
    const relayMs = protectionEnabled
      ? relayDecisionMs(faultCurrentA, settings, cfg.curveMode)
      : null

    if (relayMs == null) {
      // No relay trip (protection disabled or below pickup): slow clearing, no reclose.
      this.willTrip = false
      this.willLockout = false
      this.tripAtMs = null
      this.clearAtMs = t0 + (this.opts.noProtectionClearMs ?? NO_PROTECTION_CLEAR_MS)
      this.recloseAtMs = null
    } else {
      this.willTrip = true
      this.tripAtMs = t0 + relayMs
      this.clearAtMs = t0 + relayMs + settings.breakerOpenTimeMs
      this.willLockout = isLockout(shotNum, settings.shotsToLockout)
      this.recloseAtMs = this.willLockout ? null : this.clearAtMs + cfg.recloseDelayMs
    }
  }

  private setTerminal(reason: TerminalReason) {
    this.terminal = true
    this.terminalReason = reason
  }

  /**
   * Advance the FSM to time `tMs`. `clearanceFt` is the live faulted-pair clearance;
   * `slappedDuringDeadTime` indicates a conductor clash since the breaker last opened.
   */
  step(
    tMs: number,
    clearanceFt: number,
    thresholdFt: number,
    slappedDuringDeadTime = false,
  ): ProtectionSnapshot {
    // Process any due transitions (typically at most one per step).
    // eslint-disable-next-line no-constant-condition
    while (true) {
      if (this.terminal) break

      // Kick off the first fault.
      if (this.shot === 0) {
        if (tMs >= this.opts.faultStartMs) {
          this.beginFaultPeriod(this.opts.faultStartMs, 1)
          this.push(this.periodStart, 'FAULT_ACTIVE', 'fault', 'Fault initiated', 'Short-circuit current begins')
          continue
        }
        break
      }

      // Within an active fault period, before clearing.
      if (tMs < this.clearAtMs) {
        if (this.willTrip && this.tripAtMs != null && tMs >= this.tripAtMs && !this.emittedTrip) {
          this.emittedTrip = true
          this.push(this.tripAtMs, 'TRIP_COMMAND', 'trip', 'Trip command', 'Relay issues trip')
        }
        break
      }

      // Breaker opens / fault cleared. The de-energized line may still be mechanically
      // close, but no current flows until a reclose.
      if (!this.emittedOpen) {
        this.emittedOpen = true
        this.push(this.clearAtMs, 'BREAKER_OPENING', 'open', 'Breaker open', 'Fault current interrupted')
      }

      if (!this.willTrip) {
        // No protection / no trip: de-energized after slow clear; no reclose.
        this.setTerminal('noclear')
        break
      }

      if (this.willLockout) {
        this.push(this.clearAtMs, 'LOCKOUT', 'lockout', 'Lockout', `Locked out after ${this.shot} operations`)
        this.setTerminal('lockout')
        break
      }

      // Dead time until reclose.
      if (this.recloseAtMs != null && tMs >= this.recloseAtMs) {
        if (!this.emittedReclose) {
          this.emittedReclose = true
          this.push(this.recloseAtMs, 'RECLOSE', 'reclose', 'Reclose', 'Voltage reapplied')
        }
        // A deterministic "restore on attempt N" overrides everything: re-strike until this
        // reclose attempt (= the operation that just tripped), then restore. Otherwise fall back
        // to a persistent fault or the conductor-clearance (slap) decision.
        let outcome: RecloseOutcome
        if (this.opts.restoreOnReclose != null) {
          outcome = this.shot >= this.opts.restoreOnReclose ? 'restore' : 'restrike'
        } else {
          outcome = recloseOutcome(
            clearanceFt,
            thresholdFt,
            slappedDuringDeadTime || !!this.opts.faultPersists,
          )
        }
        if (outcome === 'restore') {
          this.faultPresent = false
          this.push(this.recloseAtMs, 'RESTORED', 'restored', 'Service restored', 'Conductors clear — reclose successful')
          this.setTerminal('restored')
          break
        }
        // Re-strike into a still-close conductor pair.
        const t0 = this.recloseAtMs
        this.beginFaultPeriod(t0, this.shot + 1)
        this.push(t0, 'FAULT_ACTIVE', 'slap', 'Induced slap fault', 'Conductors still close on reclose — re-strike')
        continue
      }

      break
    }

    return this.snapshot(tMs)
  }

  private snapshot(tMs: number): ProtectionSnapshot {
    if (this.terminal) {
      const reason = this.terminalReason
      const state: ProtectionState =
        reason === 'restored' ? 'RESTORED' : reason === 'lockout' ? 'LOCKOUT' : 'DEAD_TIME'
      return {
        state,
        energized: reason === 'restored',
        faultActive: false,
        shot: this.shot,
        terminal: true,
        terminalReason: reason,
      }
    }

    if (this.shot === 0) {
      return {
        state: 'NORMAL',
        energized: true,
        faultActive: false,
        shot: 0,
        terminal: false,
        terminalReason: null,
      }
    }

    // Active fault period (energized) vs dead time (de-energized).
    if (tMs < this.clearAtMs) {
      let state: ProtectionState = 'FAULT_ACTIVE'
      if (this.willTrip && this.tripAtMs != null) {
        if (tMs >= this.tripAtMs) state = 'BREAKER_OPENING'
        else if (tMs >= this.periodStart + FAULT_ACTIVE_WINDOW_MS) state = 'RELAY_TIMING'
      }
      return {
        state,
        energized: true,
        faultActive: this.faultPresent,
        shot: this.shot,
        terminal: false,
        terminalReason: null,
      }
    }

    // Dead time (breaker open, awaiting reclose).
    return {
      state: 'DEAD_TIME',
      energized: false,
      faultActive: false,
      shot: this.shot,
      terminal: false,
      terminalReason: null,
    }
  }
}
