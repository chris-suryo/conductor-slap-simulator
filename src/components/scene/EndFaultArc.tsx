import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Phase, SimulationFrame } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { frameFromArray } from '@/utils/frames'
import { COLORS } from '@/utils/labels'

const SEGMENTS = 11

/**
 * A flickering line-to-line fault arc struck at the REMOTE END of the faulted span (at the
 * dead-end pole), between the two faulted phases. Visible whenever fault current is flowing —
 * this marks the actual fault location (the short circuit driving the event), distinct from the
 * mid-span conductor-slap arc.
 */
export function EndFaultArc({
  pair,
  restX,
  attachY,
  z,
  frames,
  dtMs,
}: {
  pair: { a: Phase; b: Phase }
  restX: Record<Phase, number>
  attachY: number
  z: number
  frames: SimulationFrame[]
  dtMs: number
}) {
  const lightRef = useRef<THREE.PointLight>(null)

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEGMENTS * 3), 3))
    return g
  }, [])

  const line = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color: COLORS.arc, toneMapped: false })
    const l = new THREE.Line(geom, mat)
    l.visible = false
    return l
  }, [geom])

  useFrame(() => {
    const frame = frameFromArray(frames, dtMs, useScenarioStore.getState().cursorMs)
    const show = frame.faultActive
    line.visible = show
    if (lightRef.current) lightRef.current.visible = show
    if (!show) return

    const xa = restX[pair.a]
    const xb = restX[pair.b]
    const y = attachY
    const pos = geom.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < SEGMENTS; i++) {
      const t = i / (SEGMENTS - 1)
      const x = xa + (xb - xa) * t
      const edge = i === 0 || i === SEGMENTS - 1
      const jx = edge ? 0 : (Math.random() - 0.5) * 0.45
      const jy = edge ? 0 : (Math.random() - 0.5) * 0.8
      pos.setXYZ(i, x + jx, y + jy, z)
    }
    pos.needsUpdate = true

    if (lightRef.current) {
      lightRef.current.position.set((xa + xb) / 2, y, z)
      lightRef.current.intensity = 6 + Math.random() * 9
    }
  })

  return (
    <group>
      <primitive object={line} />
      <pointLight ref={lightRef} color={COLORS.arc} distance={20} intensity={0} visible={false} />
    </group>
  )
}
