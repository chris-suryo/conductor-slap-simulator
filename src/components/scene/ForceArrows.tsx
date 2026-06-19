import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import type { Phase } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { dispFtOf, frameAtMs } from '@/utils/frames'
import { COLORS } from '@/utils/labels'

interface ForceArrowsProps {
  pair: { a: Phase; b: Phase }
  restX: Record<Phase, number>
  attachY: number
  sagU: number
  dispGain: number
  enabled: boolean
}

function makeArrow(): THREE.ArrowHelper {
  const h = new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(), 1, COLORS.caution, 0.6, 0.42)
  ;(h.cone.material as THREE.MeshBasicMaterial).toneMapped = false
  ;(h.line.material as THREE.LineBasicMaterial).toneMapped = false
  return h
}

/** Repulsion arrows at midspan pushing the two faulted conductors apart (∝ force). */
export function ForceArrows({ pair, restX, attachY, sagU, dispGain, enabled }: ForceArrowsProps) {
  const arrowA = useMemo(makeArrow, [])
  const arrowB = useMemo(makeArrow, [])
  const dirA = useMemo(() => new THREE.Vector3(), [])
  const dirB = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const st = useScenarioStore.getState()
    const frame = frameAtMs(st.result, st.cursorMs)
    const show = enabled && frame.faultActive
    arrowA.visible = show
    arrowB.visible = show
    if (!show) return

    const xa = restX[pair.a] + dispFtOf(frame, pair.a) * dispGain
    const xb = restX[pair.b] + dispFtOf(frame, pair.b) * dispGain
    const y = attachY - sagU
    const len = THREE.MathUtils.clamp(frame.forcePerLenNPerM / 4, 0.5, 3.0)
    const sign = Math.sign(xa - xb) || -1

    arrowA.position.set(xa, y, 0)
    arrowA.setDirection(dirA.set(sign, 0, 0))
    arrowA.setLength(len, 0.5, 0.38)

    arrowB.position.set(xb, y, 0)
    arrowB.setDirection(dirB.set(-sign, 0, 0))
    arrowB.setLength(len, 0.5, 0.38)
  })

  return (
    <group>
      <primitive object={arrowA} />
      <primitive object={arrowB} />
    </group>
  )
}
