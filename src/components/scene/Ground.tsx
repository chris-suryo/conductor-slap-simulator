import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThemeColors } from '@/theme/useThemeColors'

/**
 * Static street groundplane: a grass/earth base, an asphalt road running along the
 * line (z), and instanced lane dashes down the road centre. Sits at the same y as
 * the pole bases (-POLE_HEIGHT). Theme-aware (day in light, dusk in dark); never
 * animates, so it costs nothing per frame.
 */
const GROUND_Y = -30 // matches POLE_HEIGHT in DistributionScene
const LEN = 640 // road/grass extent along z (fog swallows the ends)
const ROAD_CENTER_X = 9 // road offset so the pole line sits on the grass verge
const ROAD_HALF_W = 7
const DASH_STEP = 18
const DASH_COUNT = Math.floor(LEN / DASH_STEP)

function LaneDashes({ color }: { color: string }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  const matrices = useMemo(() => {
    const out: THREE.Matrix4[] = []
    const start = -((DASH_COUNT - 1) * DASH_STEP) / 2
    for (let i = 0; i < DASH_COUNT; i++) {
      out.push(new THREE.Matrix4().setPosition(ROAD_CENTER_X, 0.06, start + i * DASH_STEP))
    }
    return out
  }, [])
  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current.setMatrixAt(i, m))
    ref.current.instanceMatrix.needsUpdate = true
  }, [matrices])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, DASH_COUNT]}>
      <boxGeometry args={[0.55, 0.04, 5]} />
      <meshStandardMaterial color={color} roughness={0.7} metalness={0} />
    </instancedMesh>
  )
}

export function Ground({ centerZ }: { centerZ: number }) {
  const c = useThemeColors()
  return (
    <group position={[0, GROUND_Y, centerZ]}>
      {/* grass / earth base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[600, LEN]} />
        <meshStandardMaterial color={c.sceneGrass} roughness={1} metalness={0} />
      </mesh>
      {/* asphalt road, a hair above the grass to avoid z-fighting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROAD_CENTER_X, 0.02, 0]}>
        <planeGeometry args={[ROAD_HALF_W * 2, LEN]} />
        <meshStandardMaterial color={c.sceneRoad} roughness={0.95} metalness={0.03} />
      </mesh>
      <LaneDashes color={c.sceneRoadLine} />
    </group>
  )
}
