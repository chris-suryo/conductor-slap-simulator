import type { Phase, SimulationFrame } from '@/simulation/types'
import { Conductor } from './Conductor'
import { ForceArrows } from './ForceArrows'
import { MagneticFieldRings } from './MagneticFieldRings'
import { FaultArc } from './FaultArc'

interface SpanProps {
  z0: number
  z1: number
  restX: Record<Phase, number>
  attachY: number
  sagU: number
  dispGain: number
  pair: { a: Phase; b: Phase }
  isPair: boolean
  participates: (p: Phase) => boolean
  diameterIn: number
  frames: SimulationFrame[]
  dtMs: number
}

/** One span between two poles: its three conductors plus force/field/arc effects. */
export function Span({
  z0,
  z1,
  restX,
  attachY,
  sagU,
  dispGain,
  pair,
  isPair,
  participates,
  diameterIn,
  frames,
  dtMs,
}: SpanProps) {
  const midZ = (z0 + z1) / 2
  const shared = { restX, attachY, sagU, dispGain, midZ, frames, dtMs }
  return (
    <group>
      {(['A', 'B', 'C'] as Phase[]).map((ph) => (
        <Conductor
          key={ph}
          phase={ph}
          restX={restX[ph]}
          z0={z0}
          z1={z1}
          attachY={attachY}
          sagU={sagU}
          dispGain={dispGain}
          participates={participates(ph)}
          diameterIn={diameterIn}
          frames={frames}
          dtMs={dtMs}
        />
      ))}
      <ForceArrows pair={pair} enabled={isPair} {...shared} />
      <MagneticFieldRings pair={pair} isPair={isPair} {...shared} />
      {isPair && <FaultArc pair={pair} {...shared} />}
    </group>
  )
}
