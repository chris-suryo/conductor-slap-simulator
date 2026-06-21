import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useThemeColors } from '@/theme/useThemeColors'

/**
 * A faded low-poly city skyline ringing the scene on the horizon. One instanced
 * draw call of ~48 boxes with deterministic (seeded) sizes/positions, placed far
 * enough out that fog blends them toward the scene background so they read as an
 * atmospheric silhouette rather than detailed geometry. Fully static.
 */
const GROUND_Y = -30
const COUNT = 48
const R_MIN = 118
const R_MAX = 158

// Tiny deterministic PRNG so the skyline is identical every load.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function Skyline({ centerZ }: { centerZ: number }) {
  const c = useThemeColors()

  const matrices = useMemo(() => {
    const rand = mulberry32(0x5eed)
    const out: THREE.Matrix4[] = []
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const pos = new THREE.Vector3()
    const scl = new THREE.Vector3()
    for (let i = 0; i < COUNT; i++) {
      const angle = (i / COUNT) * Math.PI * 2 + rand() * 0.4
      const r = R_MIN + rand() * (R_MAX - R_MIN)
      const w = 8 + rand() * 13
      const d = 8 + rand() * 13
      const h = 12 + rand() * 40
      pos.set(Math.cos(angle) * r, GROUND_Y + h / 2, centerZ + Math.sin(angle) * r)
      scl.set(w, h, d)
      out.push(m.clone().compose(pos, q, scl))
    }
    return out
  }, [centerZ])

  const ref = useRef<THREE.InstancedMesh>(null!)
  useLayoutEffect(() => {
    matrices.forEach((m, i) => ref.current.setMatrixAt(i, m))
    ref.current.instanceMatrix.needsUpdate = true
  }, [matrices])

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={c.sceneSkyline} roughness={1} metalness={0} />
    </instancedMesh>
  )
}
