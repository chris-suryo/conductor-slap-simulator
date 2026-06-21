/**
 * Applies a theme: toggles the document class and writes the brand CSS variables.
 *
 * Neutral + status CSS variables are declared statically per theme in src/index.css (so the
 * pre-paint script in index.html can flip them with zero flash). The 3D scene's themeable
 * neutrals (background, fog, grid, poles) are set declaratively via useThemeColors() and
 * re-render only on theme change; its per-frame `useFrame` code reads only CONSTANT status
 * colors, so the hot path never needs to react to a theme switch.
 */
import type { ThemeName } from './tokens'
import { BRAND, hexToTriple } from './brand'

let brandWritten = false

/** Write the brand accent/navy CSS vars once (brand is theme-independent). */
function writeBrandVars(root: HTMLElement) {
  if (brandWritten) return
  const c = BRAND.colors
  root.style.setProperty('--brand', hexToTriple(c.accent))
  root.style.setProperty('--brand-dark', hexToTriple(c.accentDark))
  root.style.setProperty('--brand-light', hexToTriple(c.accentLight))
  root.style.setProperty('--navy', hexToTriple(c.navy))
  root.style.setProperty('--navy-light', hexToTriple(c.navyLight))
  root.style.setProperty('--navy-dark', hexToTriple(c.navyDark))
  root.style.setProperty('--on-accent', hexToTriple(c.onAccent))
  brandWritten = true
}

export function applyTheme(name: ThemeName) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('dark', 'light')
  root.classList.add(name)
  root.style.colorScheme = name
  writeBrandVars(root)
}
