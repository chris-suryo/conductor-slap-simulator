import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useThemeColors } from '@/theme/useThemeColors'
import { SCENE_EMISSIVE } from '@/utils/labels'

/**
 * A few low-poly cars driving both ways along the road, with emissive head/tail lights that
 * glow at dusk. Three instanced meshes (bodies, headlights, taillights) updated by a single
 * useFrame; positions wrap at the road ends. Mounted OUTSIDE the slap-shake group so traffic
 * never jitters when a conductor slaps.
 */
const GROUND_Y = -30
const ROAD_CENTER_X = 9
const LANE = 2.6 // half-distance between the two travel lanes
const BODY_Y = 0.55 // above the road surface
const RANGE = 340 // z span the cars loop over (fog hides the ends)
const HALF = RANGE / 2
const COUNT = 6 // total cars (split between the two directions)

interface CarSpec {
  laneX: number
  dir: 1 | -1
  speed: number
  z: number
}

export function Cars({ centerZ, isDark }: { centerZ: number; isDark: boolean }) {
  const c = useThemeColors()

  const cars = useMemo<CarSpec[]>(() => {
    const out: CarSpec[] = []
    for (let i = 0; i < COUNT; i++) {
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1
      out.push({
        laneX: ROAD_CENTER_X + (dir === 1 ? -LANE : LANE),
        dir,
        speed: 12 + (i % 3) * 4, // 12–20 u/s
        z: -HALF + (i / COUNT) * RANGE, // spread along the road
      })
    }
    return out
  }, [])

  const bodyRef = useRef<THREE.InstancedMesh>(null!)
  const headRef = useRef<THREE.InstancedMesh>(null!)
  const tailRef = useRef<THREE.InstancedMesh>(null!)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const v = useMemo(() => new THREE.Vector3(), [])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05) // clamp after tab-away
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i]
      car.z += car.dir * car.speed * dt
      if (car.z > HALF) car.z -= RANGE
      else if (car.z < -HALF) car.z += RANGE

      v.set(car.laneX, BODY_Y, car.z)
      bodyRef.current.setMatrixAt(i, m.compose(v, q, one))
      v.set(car.laneX, BODY_Y + 0.15, car.z + car.dir * 2.15)
      headRef.current.setMatrixAt(i, m.compose(v, q, one))
      v.set(car.laneX, BODY_Y + 0.15, car.z - car.dir * 2.15)
      tailRef.current.setMatrixAt(i, m.compose(v, q, one))
    }
    bodyRef.current.instanceMatrix.needsUpdate = true
    headRef.current.instanceMatrix.needsUpdate = true
    tailRef.current.instanceMatrix.needsUpdate = true
  })

  const headI = isDark ? 3 : 0.25
  const tailI = isDark ? 2 : 0.5

  return (
    <group position={[0, GROUND_Y, centerZ]}>
      <instancedMesh ref={bodyRef} args={[undefined, undefined, COUNT]}>
        <boxGeometry args={[2, 1, 4.2]} />
        <meshStandardMaterial color={c.sceneCarBody} roughness={0.4} metalness={0.6} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, COUNT]}>
        <boxGeometry args={[1.3, 0.3, 0.2]} />
        <meshStandardMaterial
          color={c.sceneCarHead}
          emissive={SCENE_EMISSIVE.carHead}
          emissiveIntensity={headI}
          toneMapped={false}
        />
      </instancedMesh>
      <instancedMesh ref={tailRef} args={[undefined, undefined, COUNT]}>
        <boxGeometry args={[1.3, 0.3, 0.2]} />
        <meshStandardMaterial
          color={c.sceneCarTail}
          emissive={SCENE_EMISSIVE.carTail}
          emissiveIntensity={tailI}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  )
}
