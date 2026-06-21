import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useThemeColors } from '@/theme/useThemeColors'
import { SCENE_EMISSIVE } from '@/utils/labels'

/**
 * The feeder continuing past the three instrumented poles in both directions — now with
 * real hardware (crossarms, insulators, a pole-mounted transformer) and dusk street lamps,
 * so it reads as a real street rather than bare sticks. Everything is instanced (≈1 draw
 * call per part) and static; the only lights are ≤2 real pointlights on the nearest lamps.
 * Placed beyond the spans so nothing overlaps the physics. Fog fades the far ones out.
 */
const POLE_HEIGHT = 30 // pole centre at y=-15 (spans crossarm 0 → ground -30)
const TOP_Y = 0 // pole top / crossarm height
const SPACING = 42 // distance between distant poles along z
const PER_SIDE = 6

/** Minimal instanced-mesh helper: sets matrices once from a memoized list. */
function Instanced({ matrices, children }: { matrices: THREE.Matrix4[]; children: ReactNode }) {
  const ref = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current.setMatrixAt(i, m))
    ref.current.instanceMatrix.needsUpdate = true
  }, [matrices])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, matrices.length]}>
      {children}
    </instancedMesh>
  )
}

export function DistantPoles({
  leftSpanU,
  rightSpanU,
  spacing,
  isDark,
}: {
  leftSpanU: number
  rightSpanU: number
  spacing: number
  isDark: boolean
}) {
  const c = useThemeColors()
  const armLength = spacing * 2 + 1.6

  const built = useMemo(() => {
    const zs: number[] = []
    for (let k = 1; k <= PER_SIDE; k++) {
      zs.push(rightSpanU + k * SPACING)
      zs.push(-leftSpanU - k * SPACING)
    }
    const id = new THREE.Quaternion()
    const one = new THREE.Vector3(1, 1, 1)
    const mat = (x: number, y: number, z: number) =>
      new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), id, one)

    const poles = zs.map((z) => mat(0, -POLE_HEIGHT / 2, z))
    const arms = zs.map((z) => mat(0, TOP_Y + 0.58, z))
    const insulators: THREE.Matrix4[] = []
    zs.forEach((z) => {
      ;[-spacing, 0, spacing].forEach((x) => insulators.push(mat(x, TOP_Y + 0.27, z)))
    })

    // Street lamps on alternate poles: an arm reaching toward the road (+x) + a glowing head.
    const lampArms: THREE.Matrix4[] = []
    const lampHeads: THREE.Matrix4[] = []
    zs.forEach((z, i) => {
      if (i % 2 !== 0) return
      lampArms.push(mat(1.2, TOP_Y + 1.1, z))
      lampHeads.push(mat(2.4, TOP_Y + 1.0, z))
    })

    // Nearest +z lamp heads get a real pointlight (cap at 2).
    const lampLightPositions = zs
      .map((z, i) => ({ z, i }))
      .filter(({ i }) => i % 2 === 0)
      .map(({ z }) => z)
      .sort((a, b) => b - a) // closest to the camera (largest +z) first
      .slice(0, 2)
      .map((z) => new THREE.Vector3(2.4, TOP_Y + 1.0, z))

    // One pole-mounted transformer can on a near +z pole.
    const transformerZ = rightSpanU + 2 * SPACING
    return { poles, arms, insulators, lampArms, lampHeads, lampLightPositions, transformerZ }
  }, [leftSpanU, rightSpanU, spacing])

  const lampEmissive = isDark ? 1.4 : 0

  return (
    <group>
      {/* poles */}
      <Instanced matrices={built.poles}>
        <cylinderGeometry args={[0.42, 0.66, POLE_HEIGHT, 10]} />
        <meshStandardMaterial color={c.scenePole} roughness={0.92} metalness={0.04} />
      </Instanced>
      {/* crossarms */}
      <Instanced matrices={built.arms}>
        <boxGeometry args={[armLength, 0.3, 0.42]} />
        <meshStandardMaterial color={c.sceneCrossarm} roughness={0.7} metalness={0.25} />
      </Instanced>
      {/* insulators */}
      <Instanced matrices={built.insulators}>
        <cylinderGeometry args={[0.1, 0.13, 0.56, 8]} />
        <meshStandardMaterial color={c.sceneInsulator} roughness={0.45} metalness={0.15} />
      </Instanced>
      {/* lamp arms */}
      <Instanced matrices={built.lampArms}>
        <boxGeometry args={[2.4, 0.12, 0.12]} />
        <meshStandardMaterial color={c.sceneCrossarm} roughness={0.6} metalness={0.4} />
      </Instanced>
      {/* lamp heads (glow at dusk) */}
      <Instanced matrices={built.lampHeads}>
        <boxGeometry args={[0.5, 0.28, 0.5]} />
        <meshStandardMaterial
          color={c.sceneLamp}
          emissive={SCENE_EMISSIVE.lamp}
          emissiveIntensity={lampEmissive}
          roughness={0.5}
          metalness={0.2}
          toneMapped={false}
        />
      </Instanced>
      {/* a real warm pool of light under the nearest lamp(s) — dusk only */}
      {isDark &&
        built.lampLightPositions.map((p, i) => (
          <pointLight key={i} position={p} color={SCENE_EMISSIVE.lamp} intensity={6} distance={26} decay={2} />
        ))}
      {/* pole-mounted transformer can */}
      <mesh position={[0.95, TOP_Y - 4, built.transformerZ]}>
        <cylinderGeometry args={[0.7, 0.7, 1.7, 12]} />
        <meshStandardMaterial color={c.sceneTransformer} roughness={0.6} metalness={0.45} />
      </mesh>
    </group>
  )
}
