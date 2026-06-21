import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThemeColors } from '@/theme/useThemeColors'

/**
 * A line of decorative poles continuing past the three instrumented poles in both
 * directions, so the feeder reads as a real street rather than three isolated poles.
 * One instanced draw call; positions computed once. Placed beyond the spans so they
 * never overlap the physics. Fog fades the far ones into the horizon.
 */
const POLE_HEIGHT = 30 // pole centre sits at y = -POLE_HEIGHT/2 (spans crossarm 0 → ground -30)
const SPACING = 42 // distance between distant poles along z
const PER_SIDE = 6

export function DistantPoles({
  leftSpanU,
  rightSpanU,
}: {
  leftSpanU: number
  rightSpanU: number
}) {
  const c = useThemeColors()
  const matrices = useMemo(() => {
    const out: THREE.Matrix4[] = []
    for (let k = 1; k <= PER_SIDE; k++) {
      out.push(new THREE.Matrix4().setPosition(0, 0, rightSpanU + k * SPACING))
      out.push(new THREE.Matrix4().setPosition(0, 0, -leftSpanU - k * SPACING))
    }
    return out
  }, [leftSpanU, rightSpanU])

  const ref = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current.setMatrixAt(i, m))
    ref.current.instanceMatrix.needsUpdate = true
  }, [matrices])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, PER_SIDE * 2]} position={[0, -POLE_HEIGHT / 2, 0]}>
      <cylinderGeometry args={[0.42, 0.66, POLE_HEIGHT, 10]} />
      <meshStandardMaterial color={c.scenePole} roughness={0.92} metalness={0.04} />
    </instancedMesh>
  )
}
