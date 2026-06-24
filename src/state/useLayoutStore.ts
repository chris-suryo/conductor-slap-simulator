/**
 * Layout store — resizable side-panel widths + a "maximize the scene" toggle,
 * persisted to localStorage. Kept separate from useScenarioStore (simulation/playback)
 * and useThemeStore (theming) so layout changes don't wake those subscribers.
 *
 * The Shell reads `leftWidth`/`rightWidth` for the two asides and gates all chrome
 * (asides, charts, timeline) on `presentation || sceneExpanded`. Widths are clamped
 * in the setters so localStorage never holds an out-of-range value.
 */
import { create } from 'zustand'
import { clamp } from '@/utils/math'

const STORAGE_KEY = 'csim-layout'

// Drag range opened up wide so you can resize each side panel to whatever you personally find
// comfortable — drag the divider between a panel and the scene (or Tab to it + arrow keys).
// Defaults sit at a balanced middle ground; MIN/MAX just bound the drag, they don't dictate a
// "correct" width. Note this only affects the Physics/Protection setup view — Presentation mode
// hides both asides entirely (see Shell.tsx's `chromeHidden`), so the scene always gets the full
// window there regardless of these widths.
export const LEFT_MIN = 280
export const LEFT_MAX = 1000
export const RIGHT_MIN = 260
export const RIGHT_MAX = 900
const LEFT_DEFAULT = 520
const RIGHT_DEFAULT = 480

interface Persisted {
  leftWidth: number
  rightWidth: number
  sceneExpanded: boolean
}

const read = (): Persisted => {
  const fallback: Persisted = {
    leftWidth: LEFT_DEFAULT,
    rightWidth: RIGHT_DEFAULT,
    sceneExpanded: false,
  }
  if (typeof localStorage === 'undefined') return fallback
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return fallback
    const p = JSON.parse(raw) as Partial<Persisted>
    return {
      leftWidth: clamp(Number(p.leftWidth) || LEFT_DEFAULT, LEFT_MIN, LEFT_MAX),
      rightWidth: clamp(Number(p.rightWidth) || RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX),
      sceneExpanded: Boolean(p.sceneExpanded),
    }
  } catch {
    return fallback
  }
}

interface LayoutState extends Persisted {
  setLeftWidth: (px: number) => void
  setRightWidth: (px: number) => void
  toggleSceneExpanded: () => void
  resetWidths: () => void
}

const persist = (s: Persisted) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export const useLayoutStore = create<LayoutState>((set, get) => {
  const init = read()

  const save = () => {
    const { leftWidth, rightWidth, sceneExpanded } = get()
    persist({ leftWidth, rightWidth, sceneExpanded })
  }

  return {
    ...init,
    setLeftWidth: (px) => {
      set({ leftWidth: clamp(px, LEFT_MIN, LEFT_MAX) })
      save()
    },
    setRightWidth: (px) => {
      set({ rightWidth: clamp(px, RIGHT_MIN, RIGHT_MAX) })
      save()
    },
    toggleSceneExpanded: () => {
      set({ sceneExpanded: !get().sceneExpanded })
      save()
    },
    resetWidths: () => {
      set({ leftWidth: LEFT_DEFAULT, rightWidth: RIGHT_DEFAULT })
      save()
    },
  }
})

// Dev-only: expose for scripted verification (mirrors window.__store / window.__theme).
if (import.meta.env.DEV) {
  ;(window as unknown as { __layout?: typeof useLayoutStore }).__layout = useLayoutStore
}
