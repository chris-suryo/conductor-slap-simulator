/**
 * Contact / near-miss / slap classification for the faulted conductor pair.
 *
 * Clearance is surface-to-surface (center-to-center separation minus one conductor
 * diameter, i.e. two radii). A small `CONTACT_VISUAL_SAFETY_FT` margin lets the demo
 * register a teaching "slap" just before literal metal-to-metal contact — on a
 * re-energized circuit the final small gap flashes over anyway.
 */
import type { ConductorType, ContactStatus } from './types'
import { CONTACT_VISUAL_SAFETY_FT, NEAR_MISS_BAND_FT } from './constants'
import { inToFt } from './units'

/** Overall conductor diameter (ft). */
export function conductorDiameterFt(conductor: ConductorType): number {
  return inToFt(conductor.diameterIn)
}

/** Surface-to-surface clearance (ft) from a center-to-center separation. */
export function clearanceFt(pairSeparationFt: number, conductor: ConductorType): number {
  return pairSeparationFt - conductorDiameterFt(conductor)
}

/** Clearance (ft) at or under which a slap is registered. */
export const CONTACT_THRESHOLD_FT = CONTACT_VISUAL_SAFETY_FT

/** Classify a surface-to-surface clearance into safe / near-miss / contact. */
export function classifyClearance(clearFt: number): ContactStatus {
  if (clearFt <= CONTACT_THRESHOLD_FT) return 'contact'
  if (clearFt <= CONTACT_THRESHOLD_FT + NEAR_MISS_BAND_FT) return 'near-miss'
  return 'safe'
}
