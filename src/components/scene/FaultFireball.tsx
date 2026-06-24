import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Phase, SimulationFrame } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { frameFromArray } from '@/utils/frames'
import { COLORS } from '@/utils/labels'

const SMOKE_COUNT = 5
const SMOKE_LIFE_S = 1.4

/** Soft radial-gradient sprite texture shared by every smoke puff (one canvas, drawn once). */
let puffTexture: THREE.CanvasTexture | null = null
function getPuffTexture(): THREE.CanvasTexture {
  if (puffTexture) return puffTexture
  const cvs = document.createElement('canvas')
  cvs.width = 64
  cvs.height = 64
  const ctx = cvs.getContext('2d')!
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 64, 64)
  puffTexture = new THREE.CanvasTexture(cvs)
  return puffTexture
}

interface Puff {
  sprite: THREE.Sprite
  age: number
  offsetX: number
  offsetZ: number
}

/**
 * A small fireball + rising smoke puffs at the fault location (the REMOTE END of the faulted
 * span, at the dead-end pole) — replaces the earlier flickering arc line. Reads at a glance as
 * "something just burned here," distinct from the mid-span conductor-slap arc in FaultArc.tsx.
 */
export function FaultFireball({
  phases,
  restX,
  attachY,
  z,
  frames,
  dtMs,
}: {
  /** Every conductor involved in the fault — the fireball centers on their average position
   * (a single faulted phase for AG/BG/CG, the midpoint for an L-L pair, dead-center for ABC). */
  phases: Phase[]
  restX: Record<Phase, number>
  attachY: number
  z: number
  frames: SimulationFrame[]
  dtMs: number
}) {
  const fireRef = useRef<THREE.Mesh>(null)
  const fireMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const smokeGroupRef = useRef<THREE.Group>(null)

  const midX = phases.reduce((sum, ph) => sum + restX[ph], 0) / phases.length

  const puffs = useMemo<Puff[]>(() => {
    const tex = getPuffTexture()
    return Array.from({ length: SMOKE_COUNT }, (_, i) => {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: '#3a3a3a',
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
      return {
        sprite: new THREE.Sprite(mat),
        age: (i / SMOKE_COUNT) * SMOKE_LIFE_S,
        offsetX: (Math.random() - 0.5) * 0.6,
        offsetZ: (Math.random() - 0.5) * 0.6,
      }
    })
  }, [])

  useFrame((_, delta) => {
    const frame = frameFromArray(frames, dtMs, useScenarioStore.getState().cursorMs)
    const show = frame.faultActive

    if (fireRef.current) fireRef.current.visible = show
    if (lightRef.current) lightRef.current.visible = show
    if (smokeGroupRef.current) smokeGroupRef.current.visible = show
    if (!show) return

    const y = attachY

    if (fireRef.current) {
      fireRef.current.position.set(midX, y, z)
      fireRef.current.scale.setScalar(2.2 + Math.random() * 1.2)
    }
    if (fireMatRef.current) {
      fireMatRef.current.color.set(Math.random() < 0.5 ? '#ffb33d' : COLORS.arc)
    }
    if (lightRef.current) {
      lightRef.current.position.set(midX, y, z)
      lightRef.current.intensity = 14 + Math.random() * 14
    }

    // Each puff rises, expands, and fades out, then resets to loop continuously.
    for (const p of puffs) {
      p.age += delta
      if (p.age > SMOKE_LIFE_S) {
        p.age -= SMOKE_LIFE_S
        p.offsetX = (Math.random() - 0.5) * 0.6
        p.offsetZ = (Math.random() - 0.5) * 0.6
      }
      const t = p.age / SMOKE_LIFE_S
      const rise = t * 2.2
      const scale = 0.4 + t * 1.6
      const opacity = (1 - t) * 0.5
      p.sprite.position.set(midX + p.offsetX, y + rise, z + p.offsetZ)
      p.sprite.scale.setScalar(scale)
      ;(p.sprite.material as THREE.SpriteMaterial).opacity = opacity
    }
  })

  return (
    <group>
      <mesh ref={fireRef} visible={false}>
        <sphereGeometry args={[0.45, 10, 10]} />
        <meshBasicMaterial ref={fireMatRef} color={COLORS.arc} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      <pointLight ref={lightRef} color={COLORS.arc} distance={32} intensity={0} visible={false} />
      <group ref={smokeGroupRef} visible={false}>
        {puffs.map((p, i) => (
          <primitive key={i} object={p.sprite} />
        ))}
      </group>
    </group>
  )
}
