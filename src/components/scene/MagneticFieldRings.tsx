import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { Phase } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { dispFtOf, frameAtMs } from '@/utils/frames'
import { COLORS } from '@/utils/labels'

interface RingsProps {
  phase: Phase
  restX: Record<Phase, number>
  attachY: number
  sagU: number
  dispGain: number
}

/** Expanding magnetic-field rings around one energized faulted conductor at midspan. */
function PhaseRings({ phase, restX, attachY, sagU, dispGain }: RingsProps) {
  const groupRef = useRef<THREE.Group>(null)
  const r0 = useRef<THREE.Mesh>(null)
  const r1 = useRef<THREE.Mesh>(null)
  const r2 = useRef<THREE.Mesh>(null)
  const rings = [r0, r1, r2]

  useFrame((state) => {
    const st = useScenarioStore.getState()
    const frame = frameAtMs(st.result, st.cursorMs)
    const show = frame.faultActive
    if (groupRef.current) groupRef.current.visible = show
    if (!show) return

    const x = restX[phase] + dispFtOf(frame, phase) * dispGain
    groupRef.current!.position.set(x, attachY - sagU, 0)

    const t = state.clock.elapsedTime
    rings.forEach((r, i) => {
      const mesh = r.current
      if (!mesh) return
      const frac = (t * 0.9 + i / rings.length) % 1
      const s = 0.5 + frac * 1.7
      mesh.scale.set(s, s, s)
      ;(mesh.material as THREE.MeshBasicMaterial).opacity = (1 - frac) * 0.5
    })
  })

  return (
    <group ref={groupRef} visible={false}>
      {rings.map((r, i) => (
        <mesh key={i} ref={r}>
          <torusGeometry args={[0.85, 0.035, 8, 44]} />
          <meshBasicMaterial color={COLORS.energized} transparent opacity={0.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function MagneticFieldRings({
  pair,
  isPair,
  restX,
  attachY,
  sagU,
  dispGain,
}: {
  pair: { a: Phase; b: Phase }
  isPair: boolean
  restX: Record<Phase, number>
  attachY: number
  sagU: number
  dispGain: number
}) {
  return (
    <group>
      <PhaseRings phase={pair.a} restX={restX} attachY={attachY} sagU={sagU} dispGain={dispGain} />
      {isPair && (
        <PhaseRings phase={pair.b} restX={restX} attachY={attachY} sagU={sagU} dispGain={dispGain} />
      )}
    </group>
  )
}
