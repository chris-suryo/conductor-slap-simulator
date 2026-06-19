import type { Phase, SimulationFrame, SimulationResult } from '@/simulation/types'

/** Sample the frame nearest a given time (ms). Frames are on a uniform dt grid. */
export function frameAtMs(result: SimulationResult, ms: number): SimulationFrame {
  const { frames, dtMs } = result
  const idx = Math.min(frames.length - 1, Math.max(0, Math.round(ms / dtMs)))
  return frames[idx]
}

/** Lateral displacement (ft) of a given phase in a frame. */
export function dispFtOf(frame: SimulationFrame, phase: Phase): number {
  return phase === 'A' ? frame.dispAFt : phase === 'B' ? frame.dispBFt : frame.dispCFt
}
