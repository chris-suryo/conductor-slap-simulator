/**
 * Theme store — dark default + light mode, persisted to localStorage.
 *
 * Mirrors the conventions of useScenarioStore (Zustand, DEV `window.__theme`). The header
 * ThemeToggle drives `toggle()`; charts read the resolved palette via useThemeColors(); the
 * 3D scene reads the `sceneColors` singleton updated by applyTheme().
 */
import { create } from 'zustand'
import { applyTheme } from '@/theme/applyTheme'
import type { ThemeName } from '@/theme/tokens'

export type ThemePref = 'dark' | 'light' | 'system'

const STORAGE_KEY = 'csim-theme'

const prefersDark = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches

const resolve = (pref: ThemePref): ThemeName =>
  pref === 'system' ? (prefersDark() ? 'dark' : 'light') : pref

const readPref = (): ThemePref => {
  if (typeof localStorage === 'undefined') return 'dark'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'dark'
}

interface ThemeState {
  pref: ThemePref
  resolved: ThemeName
  setPref: (pref: ThemePref) => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const pref = readPref()
  const resolved = resolve(pref)
  // Reconcile the document + scene singleton with the stored preference on load.
  applyTheme(resolved)

  return {
    pref,
    resolved,
    setPref: (pref) => {
      const resolved = resolve(pref)
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, pref)
      applyTheme(resolved)
      set({ pref, resolved })
    },
    toggle: () => {
      const next: ThemeName = get().resolved === 'dark' ? 'light' : 'dark'
      if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, next)
      applyTheme(next)
      set({ pref: next, resolved: next })
    },
  }
})

// Follow the OS preference while the user is on "system".
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().pref !== 'system') return
    const resolved: ThemeName = prefersDark() ? 'dark' : 'light'
    applyTheme(resolved)
    useThemeStore.setState({ resolved })
  })
}

// Dev-only: expose for scripted verification (mirrors window.__store).
if (import.meta.env.DEV) {
  ;(window as unknown as { __theme?: typeof useThemeStore }).__theme = useThemeStore
}
