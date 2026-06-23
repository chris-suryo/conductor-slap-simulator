import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useScenarioStore } from '@/state/useScenarioStore'
import { buildPalette } from '@/theme/tokens'

export interface ChartPoint {
  tS: number
  force: number
  clearance: number
  separation: number
}

/** Downsampled per-frame series for the charts (recomputed once per simulation). */
export function useChartData(): ChartPoint[] {
  const result = useScenarioStore((s) => s.result)
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
      })
    }
    return pts
  }, [result])
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

/** Recharts styling — pinned to the light palette so the 3 chart cards stay light regardless
 * of the app's active dark/light theme (matches the `force-light` class on their Card). */
export function useChartTheme(): ChartTheme {
  const c = useMemo(() => buildPalette('light'), [])
  return {
    axisTick: { fontSize: 10, fill: c.text3 },
    gridStroke: c.gridLine,
    axisLine: c.edge,
    tooltip: {
      backgroundColor: c.tooltipBg,
      border: `1px solid ${c.edge}`,
      borderRadius: 8,
      fontSize: 11,
      color: c.text1,
      boxShadow: '0 10px 30px -16px rgba(2, 8, 18, 0.55)',
    },
    playhead: c.playhead,
    surface: c.panel,
  }
}
