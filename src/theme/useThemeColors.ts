/** Hook returning the active theme's concrete color palette (for Recharts and other JS consumers). */
import { useMemo } from 'react'
import { useThemeStore } from '@/state/useThemeStore'
import { buildPalette, type ThemePalette } from './tokens'

export function useThemeColors(): ThemePalette {
  const resolved = useThemeStore((s) => s.resolved)
  return useMemo(() => buildPalette(resolved), [resolved])
}
