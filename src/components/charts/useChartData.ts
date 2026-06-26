import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useScenarioStore } from '@/state/useScenarioStore'
import { useThemeStore } from '@/state/useThemeStore'
import { buildPalette } from '@/theme/tokens'

export interface ChartPoint {
  tS: number
  force: number
  clearance: number
  separation: number
  /** Span 1 (nearest the source) live clearance, ft — null once that span's frames run out. */
  clearance1: number | null
  /** Span 2 (mid pole → recloser) live clearance, ft — null once that span's frames run out. */
  clearance2: number | null
  /** Span 1 live force per length, N/m — null once that span's frames run out. */
  force1: number | null
  /** Span 2 live force per length, N/m — null once that span's frames run out. */
  force2: number | null
}

/** Downsampled per-frame series for the charts (recomputed once per simulation). */
export function useChartData(): ChartPoint[] {
  const result = useScenarioStore((s) => s.result)
  const span1Frames = useScenarioStore((s) => s.span1Frames)
  const span2Frames = useScenarioStore((s) => s.span2Frames)
  return useMemo(() => {
    const frames = result.frames
    const target = 260
    const step = Math.max(1, Math.floor(frames.length / target))
    const pts: ChartPoint[] = []
    for (let i = 0; i < frames.length; i += step) {
      const f = frames[i]
      pts.push({
        tS: f.tMs / 1000,
        force: f.forcePerLenNPerM,
        clearance: Math.max(f.clearanceFt, 0),
        separation: f.pairSeparationFt,
        clearance1: span1Frames[i] ? Math.max(span1Frames[i].clearanceFt, 0) : null,
        clearance2: span2Frames[i] ? Math.max(span2Frames[i].clearanceFt, 0) : null,
        force1: span1Frames[i] ? span1Frames[i].forcePerLenNPerM : null,
        force2: span2Frames[i] ? span2Frames[i].forcePerLenNPerM : null,
      })
    }
    return pts
  }, [result, span1Frames, span2Frames])
}

/** Cursor position (ms) sampled at a modest rate so charts don't re-render every frame. */
export function useThrottledCursor(hz = 14): number {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      if (t - last > 1000 / hz) {
        last = t
        setMs(useScenarioStore.getState().cursorMs)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [hz])
  return ms
}

export interface ChartTheme {
  axisTick: { fontSize: number; fill: string }
  gridStroke: string
  axisLine: string
  tooltip: CSSProperties
  /** Cursor / playhead line color (light line on dark, dark line on light). */
  playhead: string
  /** Surface color for marker strokes (e.g. the TCC operating dot ring). */
  surface: string
}

/** Recharts styling — follows the app's active dark/light theme, same as every other panel. */
export function useChartTheme(): ChartTheme {
  const resolved = useThemeStore((s) => s.resolved)
  const c = useMemo(() => buildPalette(resolved), [resolved])
  return {
    axisTick: { fontSize: 39, fill: c.text3 },
    gridStroke: c.gridLine,
    axisLine: c.edge,
    tooltip: {
      backgroundColor: c.tooltipBg,
      border: `1px solid ${c.edge}`,
      borderRadius: 8,
      fontSize: 39,
      color: c.text1,
      boxShadow: '0 10px 30px -16px rgba(2, 8, 18, 0.55)',
    },
    playhead: c.playhead,
    surface: c.panel,
  }
}
