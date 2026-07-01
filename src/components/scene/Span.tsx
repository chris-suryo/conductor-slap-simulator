import type { Phase, SimulationFrame } from '@/simulation/types'
import { Conductor } from './Conductor'
import { ForceArrows } from './ForceArrows'
import { MagneticFieldRings } from './MagneticFieldRings'
import { FaultArc } from './FaultArc'
import { NeutralConductor } from './NeutralConductor'

/** Every unique conductor pair, used to render one slap arc per pair for a 3-phase fault. */
const ALL_PAIRS: { a: Phase; b: Phase }[] = [
  { a: 'A', b: 'B' },
  { a: 'B', b: 'C' },
  { a: 'A', b: 'C' },
]

interface SpanProps {
  z0: number
  z1: number
  restX: Record<Phase, number>
  attachY: number
  sagU: number
  dispGain: number
  /** Every conductor carrying fault current (1 ground, 2 L-L, 3 ABC). */
  phases: Phase[]
  participates: (p: Phase) => boolean
  diameterIn: number
  frames: SimulationFrame[]
  dtMs: number
  /** Show force arrows / field rings / mid-span slap arc. Off for context (upstream) spans. */
  showEffects?: boolean
}

/** One span between two poles: its three conductors plus optional force/field/arc effects. */
export function Span({
  z0,
  z1,
  restX,
  attachY,
  sagU,
  dispGain,
  phases,
  participates,
  diameterIn,
  frames,
  dtMs,
  showEffects = true,
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
      <NeutralConductor
        restX={restX.B}
        z0={z0}
        z1={z1}
        attachY={attachY}
        isGroundFault={phases.length === 1}
        frames={frames}
        dtMs={dtMs}
      />
      {showEffects && (
        <>
          <ForceArrows phases={phases} {...shared} />
          <MagneticFieldRings phases={phases} {...shared} />
          {/* Pairwise slap arcs: each watches its own pair's clearance, so a ground fault (no
              faulted pair) shows none, an L-L fault shows the one faulted pair, and a 3-phase
              fault shows all 3 — whichever pair actually swings together flashes on contact. */}
          {ALL_PAIRS.filter((p) => phases.includes(p.a) && phases.includes(p.b)).map((p) => (
            <FaultArc key={`${p.a}${p.b}`} pair={p} diameterIn={diameterIn} {...shared} />
          ))}
        </>
      )}
    </group>
  )
}
