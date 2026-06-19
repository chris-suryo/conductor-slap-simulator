/** Display metadata + formatters shared across the UI and the 3D scene. */
import type {
  ContactStatus,
  FinalState,
  ProtectionState,
  TimelineEventKind,
} from '@/simulation/types'
import type { BadgeTone } from '@/components/ui/Badge'

export const COLORS = {
  energized: '#22d3ee',
  healthy: '#34d399',
  caution: '#fbbf24',
  fault: '#f87171',
  deenergized: '#64748b',
  arc: '#ff6a4d',
  slate: '#94a3b8',
} as const

export const STATE_META: Record<ProtectionState, { label: string; tone: BadgeTone; color: string }> = {
  NORMAL: { label: 'Normal', tone: 'healthy', color: COLORS.healthy },
  FAULT_ACTIVE: { label: 'Fault active', tone: 'fault', color: COLORS.fault },
  RELAY_TIMING: { label: 'Relay timing', tone: 'caution', color: COLORS.caution },
  TRIP_COMMAND: { label: 'Trip command', tone: 'caution', color: COLORS.caution },
  BREAKER_OPENING: { label: 'Breaker opening', tone: 'deenergized', color: COLORS.slate },
  DEAD_TIME: { label: 'Dead time', tone: 'deenergized', color: COLORS.deenergized },
  RECLOSE: { label: 'Reclose', tone: 'energized', color: COLORS.energized },
  RESTORED: { label: 'Restored', tone: 'healthy', color: COLORS.healthy },
  LOCKOUT: { label: 'Lockout', tone: 'fault', color: COLORS.fault },
}

export const FINAL_META: Record<FinalState, { label: string; tone: BadgeTone; blurb: string }> = {
  RESTORED: {
    label: 'Service restored',
    tone: 'healthy',
    blurb: 'Fault cleared and the reclose found the conductors clear.',
  },
  SLAP_FAULT: {
    label: 'Conductor slap',
    tone: 'fault',
    blurb: 'Conductors swung together and slapped on the rebound.',
  },
  LOCKOUT: {
    label: 'Locked out',
    tone: 'fault',
    blurb: 'Repeated re-strikes on reclose — device locked open.',
  },
  NO_TRIP: {
    label: 'No relay trip',
    tone: 'caution',
    blurb: 'The relay did not operate; clearing was slow.',
  },
}

export const CONTACT_META: Record<ContactStatus, { label: string; tone: BadgeTone; color: string }> = {
  safe: { label: 'Clear', tone: 'healthy', color: COLORS.healthy },
  'near-miss': { label: 'Near miss', tone: 'caution', color: COLORS.caution },
  contact: { label: 'Slap', tone: 'fault', color: COLORS.fault },
}

export const EVENT_COLOR: Record<TimelineEventKind, string> = {
  normal: COLORS.healthy,
  fault: COLORS.fault,
  trip: COLORS.caution,
  open: COLORS.slate,
  reclose: COLORS.energized,
  restored: COLORS.healthy,
  lockout: COLORS.fault,
  slap: COLORS.arc,
}

// ---- formatters ----
export const fmtMs = (ms: number): string =>
  ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`

export const fmtSeconds = (ms: number): string => `${(ms / 1000).toFixed(2)} s`

export const fmtAmps = (a: number): string =>
  a >= 1000 ? `${(a / 1000).toFixed(a >= 10000 ? 1 : 2)} kA` : `${Math.round(a)} A`

export const fmtFt = (ft: number, decimals = 2): string => `${ft.toFixed(decimals)} ft`

export const fmtIn = (ft: number): string => `${(ft * 12).toFixed(1)} in`
