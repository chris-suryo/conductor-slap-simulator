import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import type { Phase, SimulationFrame } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { dispFtOf, frameFromArray } from '@/utils/frames'
import { COLORS } from '@/utils/labels'

interface RingsProps {
  phase: Phase
  restX: Record<Phase, number>
  attachY: number
  sagU: number
  dispGain: number
  midZ: number
  frames: SimulationFrame[]
  dtMs: number
}

/** Expanding magnetic-field rings around one energized faulted conductor at midspan. */
function PhaseRings({ phase, restX, attachY, sagU, dispGain, midZ, frames, dtMs }: RingsProps) {
  const groupRef = useRef<THREE.Group>(null)
  const r0 = useRef<THREE.Mesh>(null)
  const r1 = useRef<THREE.Mesh>(null)
  const r2 = useRef<THREE.Mesh>(null)
  const rings = [r0, r1, r2]

  useFrame((state) => {
    const frame = frameFromArray(frames, dtMs, useScenarioStore.getState().cursorMs)
    const show = frame.faultActive
    if (groupRef.current) groupRef.current.visible = show
    if (!show) return

    const x = restX[phase] + dispFtOf(frame, phase) * dispGain
    groupRef.current!.position.set(x, attachY - sagU, midZ)

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
  midZ,
  frames,
  dtMs,
}: {
  pair: { a: Phase; b: Phase }
  isPair: boolean
  restX: Record<Phase, number>
  attachY: number
  sagU: number
  dispGain: number
  midZ: number
  frames: SimulationFrame[]
  dtMs: number
}) {
  const shared = { restX, attachY, sagU, dispGain, midZ, frames, dtMs }
  return (
    <group>
      <PhaseRings phase={pair.a} {...shared} />
      {isPair && <PhaseRings phase={pair.b} {...shared} />}
    </group>
  )
}
