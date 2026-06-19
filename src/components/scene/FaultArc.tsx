import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Phase } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { dispFtOf, frameAtMs } from '@/utils/frames'
import { COLORS } from '@/utils/labels'

const SEGMENTS = 9

interface FaultArcProps {
  pair: { a: Phase; b: Phase }
  restX: Record<Phase, number>
  attachY: number
  sagU: number
  dispGain: number
}

/** A flickering arc + flash that appears only when the conductors are in contact. */
export function FaultArc({ pair, restX, attachY, sagU, dispGain }: FaultArcProps) {
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
    const st = useScenarioStore.getState()
    const frame = frameAtMs(st.result, st.cursorMs)
    const show = frame.contact === 'contact'
    line.visible = show
    if (lightRef.current) lightRef.current.visible = show
    if (!show) return

    const xa = restX[pair.a] + dispFtOf(frame, pair.a) * dispGain
    const xb = restX[pair.b] + dispFtOf(frame, pair.b) * dispGain
    const y = attachY - sagU
    const pos = geom.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < SEGMENTS; i++) {
      const t = i / (SEGMENTS - 1)
      const x = xa + (xb - xa) * t
      const edge = i === 0 || i === SEGMENTS - 1
      const jy = edge ? 0 : (Math.random() - 0.5) * 0.55
      const jz = edge ? 0 : (Math.random() - 0.5) * 0.35
      pos.setXYZ(i, x, y + jy, jz)
    }
    pos.needsUpdate = true

    if (lightRef.current) {
      lightRef.current.position.set((xa + xb) / 2, y, 0)
      lightRef.current.intensity = 8 + Math.random() * 10
    }
  })

  return (
    <group>
      <primitive object={line} />
      <pointLight ref={lightRef} color={COLORS.arc} distance={22} intensity={0} visible={false} />
    </group>
  )
}
