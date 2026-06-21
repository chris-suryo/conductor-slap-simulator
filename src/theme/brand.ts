/**
 * APC Relay Engineering brand layer — the ONE place to swap brand assets.
 *
 * ┌─ BRAND HAND-OFF ──────────────────────────────────────────────────────────────┐
 * │ When the official APC assets arrive, edit ONLY this file (+ drop logo files in   │
 * │ public/brand/ and update the favicon/title in index.html):                       │
 * │   1. colors.accent / colors.navy  → official hex                                 │
 * │   2. logo.src / logo.srcLight     → '/brand/<file>.svg' (and set logo.aspect)    │
 * │   3. fonts (optional)             → if brand mandates specific typefaces          │
 * │ Everything else (theme tokens, Tailwind, charts, 3D) derives from here.          │
 * └─────────────────────────────────────────────────────────────────────────────────┘
 */

export interface BrandLogo {
  /** Path to a logo for dark backgrounds (e.g. '/brand/apc-logo.svg'). null = typographic fallback. */
  src: string | null
  /** Optional separate logo for light backgrounds; falls back to `src`. */
  srcLight: string | null
  /** width / height of the logo art, used to size the <img>. */
  aspect: number
}

export interface Brand {
  name: string
  /** Boxed wordmark text (the orange "APC"). */
  wordmark: string
  /** Stacked sub-wordmark lines ("RELAY", "ENGINEERING"). */
  sub: [string, string]
  presenter: string
  site: string
  colors: {
    accent: string // primary brand accent (APC orange)
    accentDark: string
    accentLight: string
    navy: string // secondary brand (APC navy)
    navyLight: string
    navyDark: string
    /** Text/ink color that sits on top of an accent fill. */
    onAccent: string
  }
  logo: BrandLogo
  /** Optional brand-mandated font families (CSS font-family lists). null = use defaults. */
  fonts: { sans: string | null; mono: string | null }
}

export const BRAND: Brand = {
  name: 'APC Relay Engineering',
  wordmark: 'APC',
  sub: ['RELAY', 'ENGINEERING'],
  presenter: 'Harianto Suryo, P.E.',
  site: 'apcrelay.com',
  colors: {
    accent: '#fd8505', // TODO(APC): confirm exact orange
    accentDark: '#d97005',
    accentLight: '#ffab47',
    navy: '#0c3552', // TODO(APC): confirm exact navy
    navyLight: '#164a72',
    navyDark: '#0a2740',
    onAccent: '#06121e',
  },
  // Recreated APC lockup (placeholder until the official vector arrives — then just
  // replace the files in public/brand/ and keep these paths). aspect = viewBox w/h.
  logo: { src: '/brand/apc-logo.svg', srcLight: '/brand/apc-logo-light.svg', aspect: 340 / 104 },
  // Matches the APC website's IBM Plex / Carbon-style typography.
  fonts: { sans: "'IBM Plex Sans', system-ui, sans-serif", mono: "'IBM Plex Mono', ui-monospace, monospace" },
}

/** "#fd8505" -> "253 133 5" (RGB triple for CSS custom properties / Tailwind alpha mods). */
export function hexToTriple(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}
