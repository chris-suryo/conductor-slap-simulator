/**
 * Theme tokens — the single source of truth for colors.
 *
 * Two kinds of color live here:
 *  - NEUTRALS swap per theme (surfaces, text, borders, chart grid, 3D environment).
 *  - STATUS colors are CONSTANT across themes — they encode physics / protection meaning
 *    (energized, fault, arc, …) and must read identically in a live demo.
 *
 * Consumers:
 *  - Tailwind + CSS read these as CSS custom properties (declared in src/index.css). The RGB
 *    triple form (e.g. "10 26 40") lets Tailwind do `rgb(var(--panel) / <alpha-value>)`.
 *  - Recharts and the react-three-fiber scene need concrete color strings, so `buildPalette()`
 *    resolves a theme into an object of `rgb(r, g, b)` / hex strings (see useThemeColors + the
 *    `sceneColors` singleton in applyTheme.ts).
 *
 * IMPORTANT: the NEUTRALS triples below are mirrored 1:1 in the `.dark` / `.light` blocks of
 * src/index.css. If you change a value here, change it there too (and vice-versa).
 */

export type ThemeName = 'dark' | 'light'

/** Constant, theme-independent semantic status colors. */
export const STATUS = {
  energized: '#22d3ee', // cyan — line energized / current flowing
  healthy: '#34d399', // emerald — healthy / restored
  caution: '#fbbf24', // amber — near miss / relay timing
  fault: '#f87171', // red — fault / slap / lockout
  arc: '#ff6a4d', // hot orange-red — arc flash
  deenergized: '#64748b', // slate — breaker open / de-energized
  slate: '#94a3b8', // slate — breaker opening
} as const

/** Neutral tokens that swap per theme. Values are "R G B" triples (for Tailwind alpha mods). */
export const NEUTRALS: Record<ThemeName, Record<string, string>> = {
  dark: {
    base: '5 16 26',
    panel: '10 26 40',
    'panel-muted': '7 19 32',
    'panel-raised': '15 38 56',
    'edge-soft': '21 41 61',
    edge: '29 58 84',
    'edge-bright': '47 84 116',
    'text-1': '226 232 240',
    'text-2': '148 163 184',
    'text-3': '100 116 139',
    'grid-line': '22 32 44',
    'tooltip-bg': '14 20 29',
    playhead: '248 250 252',
    'scene-bg': '8 15 26',
    'scene-grid-major': '35 57 79',
    'scene-grid-minor': '15 26 38',
    'scene-pole': '74 61 47',
    'scene-crossarm': '91 102 117',
    'scene-insulator': '170 180 192',
    // Street/environment (dusk feel in dark). Scene-only — consumed by the 3D scene
    // via buildPalette(), NOT exposed as Tailwind CSS vars, so not mirrored in index.css.
    'scene-road': '26 30 38',
    'scene-road-line': '120 122 110',
    'scene-grass': '20 33 27',
    'scene-skyline': '16 26 44',
    'scene-sun': '255 150 92',
  },
  light: {
    base: '237 242 248',
    panel: '255 255 255',
    'panel-muted': '241 245 250',
    'panel-raised': '255 255 255',
    'edge-soft': '226 232 240',
    edge: '203 213 225',
    'edge-bright': '148 163 184',
    'text-1': '15 23 42',
    'text-2': '71 85 105',
    'text-3': '100 116 139',
    'grid-line': '226 232 240',
    'tooltip-bg': '255 255 255',
    playhead: '15 23 42',
    'scene-bg': '224 231 240',
    'scene-grid-major': '148 163 184',
    'scene-grid-minor': '203 213 225',
    'scene-pole': '125 104 80',
    'scene-crossarm': '130 140 154',
    'scene-insulator': '198 206 216',
    // Street/environment (day feel in light).
    'scene-road': '120 124 132',
    'scene-road-line': '232 234 238',
    'scene-grass': '150 174 130',
    'scene-skyline': '178 194 212',
    'scene-sun': '255 244 214',
  },
}

/** "12 34 56" -> "rgb(12, 34, 56)" (comma form parses everywhere, incl. three.js Color). */
const triple = (t: string): string => `rgb(${t.trim().split(/\s+/).join(', ')})`

/** Concrete-string palette for JS consumers (Recharts + the 3D scene). */
export interface ThemePalette {
  // neutrals
  base: string
  panel: string
  panelMuted: string
  panelRaised: string
  edgeSoft: string
  edge: string
  edgeBright: string
  text1: string
  text2: string
  text3: string
  gridLine: string
  tooltipBg: string
  playhead: string
  sceneBg: string
  sceneGridMajor: string
  sceneGridMinor: string
  scenePole: string
  sceneCrossarm: string
  sceneInsulator: string
  sceneRoad: string
  sceneRoadLine: string
  sceneGrass: string
  sceneSkyline: string
  sceneSun: string
  // status (constant across themes)
  energized: string
  healthy: string
  caution: string
  fault: string
  arc: string
  deenergized: string
  slate: string
}

/** Resolve a theme name into concrete color strings. */
export function buildPalette(name: ThemeName): ThemePalette {
  const n = NEUTRALS[name]
  return {
    base: triple(n.base),
    panel: triple(n.panel),
    panelMuted: triple(n['panel-muted']),
    panelRaised: triple(n['panel-raised']),
    edgeSoft: triple(n['edge-soft']),
    edge: triple(n.edge),
    edgeBright: triple(n['edge-bright']),
    text1: triple(n['text-1']),
    text2: triple(n['text-2']),
    text3: triple(n['text-3']),
    gridLine: triple(n['grid-line']),
    tooltipBg: triple(n['tooltip-bg']),
    playhead: triple(n.playhead),
    sceneBg: triple(n['scene-bg']),
    sceneGridMajor: triple(n['scene-grid-major']),
    sceneGridMinor: triple(n['scene-grid-minor']),
    scenePole: triple(n['scene-pole']),
    sceneCrossarm: triple(n['scene-crossarm']),
    sceneInsulator: triple(n['scene-insulator']),
    sceneRoad: triple(n['scene-road']),
    sceneRoadLine: triple(n['scene-road-line']),
    sceneGrass: triple(n['scene-grass']),
    sceneSkyline: triple(n['scene-skyline']),
    sceneSun: triple(n['scene-sun']),
    energized: STATUS.energized,
    healthy: STATUS.healthy,
    caution: STATUS.caution,
    fault: STATUS.fault,
    arc: STATUS.arc,
    deenergized: STATUS.deenergized,
    slate: STATUS.slate,
  }
}
