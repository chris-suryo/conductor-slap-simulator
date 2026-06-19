import { useEffect, useMemo, useState } from 'react'
import { useScenarioStore } from '@/state/useScenarioStore'

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

export const AXIS_TICK = { fontSize: 10, fill: '#64748b' } as const
export const GRID_STROKE = '#16202c'
export const TOOLTIP_STYLE = {
  backgroundColor: '#0e141d',
  border: '1px solid #1d2734',
  borderRadius: 8,
  fontSize: 11,
  color: '#e2e8f0',
} as const
