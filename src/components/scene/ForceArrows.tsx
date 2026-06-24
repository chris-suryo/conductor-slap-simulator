import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Phase, SimulationFrame } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { dispFtOf, frameFromArray } from '@/utils/frames'
import { COLORS } from '@/utils/labels'

const ALL_PHASES: Phase[] = ['A', 'B', 'C']

interface ForceArrowsProps {
  /** Every conductor carrying fault current (2 for an L-L fault, 3 for ABC). Ground faults (1
   * conductor) never reach this component — there's no pairwise repulsion to point at. */
  phases: Phase[]
  restX: Record<Phase, number>
  attachY: number
  sagU: number
  dispGain: number
  midZ: number
  frames: SimulationFrame[]
  dtMs: number
}

function makeArrow(): THREE.ArrowHelper {
  const h = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(), 1, COLORS.caution, 0.6, 0.42)
  ;(h.cone.material as THREE.MeshBasicMaterial).toneMapped = false
  ;(h.line.material as THREE.LineBasicMaterial).toneMapped = false
  return h
}

/**
 * Repulsion arrows at midspan pointing each faulted conductor AWAY from the others (∝ force).
 * For 2 conductors this is the familiar pair pushed directly apart; for 3 (ABC) each arrow
 * points away from the AVERAGE position of the other two — which collapses to the pair formula
 * when there are only 2, and naturally gives the center phase a near-zero/unstable direction
 * (length stays tiny since the underlying force on it is ~0, so it barely matters which way it
 * points).
 */
export function ForceArrows({ phases, restX, attachY, sagU, dispGain, midZ, frames, dtMs }: ForceArrowsProps) {
  const arrowA = useMemo(makeArrow, [])
  const arrowB = useMemo(makeArrow, [])
  const arrowC = useMemo(makeArrow, [])
  const arrows = useMemo<Record<Phase, THREE.ArrowHelper>>(
    () => ({ A: arrowA, B: arrowB, C: arrowC }),
    [arrowA, arrowB, arrowC],
  )
  const dirA = useMemo(() => new THREE.Vector3(), [])
  const dirB = useMemo(() => new THREE.Vector3(), [])
  const dirC = useMemo(() => new THREE.Vector3(), [])
  const dirs = useMemo<Record<Phase, THREE.Vector3>>(() => ({ A: dirA, B: dirB, C: dirC }), [dirA, dirB, dirC])

  useFrame(() => {
    const frame = frameFromArray(frames, dtMs, useScenarioStore.getState().cursorMs)
    const show = phases.length >= 2 && frame.faultActive
    const y = attachY - sagU
    const len = THREE.MathUtils.clamp(frame.forcePerLenNPerM / 4, 0.5, 3.0)

    for (const ph of ALL_PHASES) {
      const arrow = arrows[ph]
      const participates = show && phases.includes(ph)
      arrow.visible = participates
      if (!participates) continue

      const others = phases.filter((p) => p !== ph)
      const x = restX[ph] + dispFtOf(frame, ph) * dispGain
      const avgOtherX =
        others.reduce((sum, p) => sum + restX[p] + dispFtOf(frame, p) * dispGain, 0) / others.length
      const sign = Math.sign(x - avgOtherX) || -1

      arrow.position.set(x, y, midZ)
      arrow.setDirection(dirs[ph].set(sign, 0, 0))
      arrow.setLength(len, 0.5, 0.38)
    }
  })

  return (
    <group>
      <primitive object={arrowA} />
      <primitive object={arrowB} />
      <primitive object={arrowC} />
    </group>
  )
}
