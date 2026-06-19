/**
 * Simplified overcurrent protection model (teaching-grade).
 *
 * Decision logic for a single operation:
 *   - instantaneous trip if faultCurrent >= instantaneous pickup  -> relay processing time
 *   - else inverse-time trip if faultCurrent > pickup            -> IEC curve time
 *   - else no trip
 *
 * IEC 60255-style inverse characteristic:   t = TMS * ( k / (M^alpha - 1) + c ),  M = I / pickup
 *
 * The total clearing time adds the breaker/interrupter operating time. This is a
 * simplified educational model, not a relay-setting validation tool.
 */
import type { ProtectionSettings, ShotCurveMode } from './types'
import { CURVE_CONSTANTS, RELAY_PROCESSING_MS } from './constants'

/**
 * Inverse-time trip time (ms) from the IEC characteristic. Returns Infinity if the
 * current does not exceed pickup (no trip) or the curve is the definite type.
 */
export function inverseTripTimeMs(
  faultCurrentA: number,
  pickupA: number,
  curveType: ProtectionSettings['curveType'],
  timeMultiplier: number,
): number {
  if (pickupA <= 0) return Infinity
  const M = faultCurrentA / pickupA
  if (!(M > 1)) return Infinity
  const { k, alpha, c } = CURVE_CONSTANTS[curveType]
  if (k === 0) return Infinity // definite-time handled via definiteTimeMs
  const tSeconds = timeMultiplier * (k / (Math.pow(M, alpha) - 1) + c)
  return tSeconds * 1000
}

/**
 * Relay decision time (ms) for one operation, BEFORE the breaker operating time.
 * Returns null when the relay does not trip for this current/mode.
 */
export function relayDecisionMs(
  faultCurrentA: number,
  settings: ProtectionSettings,
  mode: ShotCurveMode,
): number | null {
  if (mode === 'definite') {
    return faultCurrentA > settings.phasePickupA ? settings.definiteTimeMs : null
  }

  if (mode === 'instantaneous') {
    if (faultCurrentA >= settings.phaseInstantaneousPickupA) return RELAY_PROCESSING_MS
    // Below the instantaneous threshold, a "fast" shot still rides the inverse curve.
  }

  const t = inverseTripTimeMs(
    faultCurrentA,
    settings.phasePickupA,
    settings.curveType,
    settings.timeMultiplier,
  )
  return Number.isFinite(t) ? t : null
}

/**
 * Auto relay decision used for the first operation and the TCC overlay: instantaneous
 * if above the instantaneous pickup, otherwise the inverse curve. Null = no trip.
 */
export function autoRelayDecisionMs(
  faultCurrentA: number,
  settings: ProtectionSettings,
): number | null {
  if (faultCurrentA >= settings.phaseInstantaneousPickupA) return RELAY_PROCESSING_MS
  const t = inverseTripTimeMs(
    faultCurrentA,
    settings.phasePickupA,
    settings.curveType,
    settings.timeMultiplier,
  )
  return Number.isFinite(t) ? t : null
}

/** Total clearing time (ms) = relay decision + breaker operating time. */
export function clearTimeMs(relayMs: number, settings: ProtectionSettings): number {
  return relayMs + settings.breakerOpenTimeMs
}
