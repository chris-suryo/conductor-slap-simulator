import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThemeColors } from '@/theme/useThemeColors'
import { makeNoiseTexture } from './groundTexture'

/**
 * Static street groundplane: a textured grass/earth base, a worn asphalt road running
 * along the line (z), curb strips, solid edge lines, and instanced centre-line dashes.
 * Sits at the pole-base height (-POLE_HEIGHT). Theme-aware; never animates (procedural
 * textures are generated once), so it costs nothing per frame.
 */
const GROUND_Y = -30 // matches POLE_HEIGHT in DistributionScene
const LEN = 640 // road/grass extent along z (fog swallows the ends)
const ROAD_CENTER_X = 37 // road offset so the pole line (x=0) sits 30 ft off the road's near edge
const ROAD_HALF_W = 7
const DASH_STEP = 18
const DASH_COUNT = Math.floor(LEN / DASH_STEP)
const EDGE_OFFSET = ROAD_HALF_W - 0.4 // solid edge lines just inside the asphalt
const CURB_OFFSET = ROAD_HALF_W + 0.6 // raised curb just outside the asphalt

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
  // Procedural textures (built once): grass tonal mottling + worn-asphalt roughness.
  const grassTex = useMemo(() => {
    const t = makeNoiseTexture(0x6a55)
    t.repeat.set(8, 8)
    return t
  }, [])
  const roadTex = useMemo(() => {
    const t = makeNoiseTexture(0x9c01)
    t.repeat.set(2, 40) // stretched along z → worn lane streaks
    return t
  }, [])

  return (
    <group position={[0, GROUND_Y, centerZ]}>
      {/* grass / earth base — noise map breaks the flat plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[600, LEN]} />
        <meshStandardMaterial color="#96ae82" map={grassTex} roughness={1} metalness={0} />
      </mesh>
      {/* asphalt road, a hair above the grass to avoid z-fighting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[ROAD_CENTER_X, 0.02, 0]}>
        <planeGeometry args={[ROAD_HALF_W * 2, LEN]} />
        <meshStandardMaterial color={c.sceneRoad} roughnessMap={roadTex} roughness={1} metalness={0.03} />
      </mesh>
      {/* solid edge lines + centre dashes */}
      {[-EDGE_OFFSET, EDGE_OFFSET].map((dx) => (
        <mesh key={dx} rotation={[-Math.PI / 2, 0, 0]} position={[ROAD_CENTER_X + dx, 0.04, 0]}>
          <planeGeometry args={[0.35, LEN]} />
          <meshStandardMaterial color={c.sceneRoadLine} roughness={0.7} metalness={0} />
        </mesh>
      ))}
      <LaneDashes color={c.sceneRoadLine} />
      {/* raised curb strips on each side */}
      {[-CURB_OFFSET, CURB_OFFSET].map((dx) => (
        <mesh key={dx} position={[ROAD_CENTER_X + dx, 0.12, 0]}>
          <boxGeometry args={[1.2, 0.24, LEN]} />
          <meshStandardMaterial color={c.sceneCurb} roughness={0.9} metalness={0.02} />
        </mesh>
      ))}
    </group>
  )
}
