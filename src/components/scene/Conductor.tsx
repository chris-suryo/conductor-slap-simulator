import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Phase, SimulationFrame } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { frameFromArray } from '@/utils/frames'
import { COLORS } from '@/utils/labels'

interface ConductorProps {
  phase: Phase
  restX: number
  /** Span endpoints along the line (z). */
  z0: number
  z1: number
  attachY: number
  sagU: number
  dispGain: number
  participates: boolean
  diameterIn: number
  /** Displacement series for THIS span. */
  frames: SimulationFrame[]
  dtMs: number
}

/**
 * A sagging conductor rendered as a tube through [pole, displaced-midspan, pole].
 * The midspan lateral position is read from this span's frame series each animation
 * frame; the material glows when energized and turns hot during an active fault.
 */
export function Conductor({
  phase,
  restX,
  z0,
  z1,
  attachY,
  sagU,
  dispGain,
  participates,
  diameterIn,
  frames,
  dtMs,
}: ConductorProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const radius = 0.1 + diameterIn * 0.06
  const midZ = (z0 + z1) / 2

  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(restX, attachY, z0),
        new THREE.Vector3(restX, attachY - sagU, midZ),
        new THREE.Vector3(restX, attachY, z1),
      ]),
    [restX, attachY, sagU, z0, z1, midZ],
  )

  // Seed lastDisp to +Infinity so the first frame always rebuilds the tube.
  const anim = useRef({ lastDisp: Number.POSITIVE_INFINITY, intensity: 0.16 })
  const tmpColor = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    const cursorMs = useScenarioStore.getState().cursorMs
    const frame = frameFromArray(frames, dtMs, cursorMs)
    const dispFt = phase === 'A' ? frame.dispAFt : phase === 'B' ? frame.dispBFt : frame.dispCFt
    const disp = dispFt * dispGain

    if (meshRef.current && Math.abs(disp - anim.current.lastDisp) > 0.0015) {
      anim.current.lastDisp = disp
      curve.points[0].set(restX, attachY, z0)
      curve.points[1].set(restX + disp, attachY - sagU, midZ)
      curve.points[2].set(restX, attachY, z1)
      const geo = new THREE.TubeGeometry(curve, 32, radius, 8, false)
      meshRef.current.geometry.dispose()
      meshRef.current.geometry = geo
    }

    let targetIntensity = 0.16
    let targetColor: string = COLORS.deenergized
    if (participates && frame.faultActive) {
      targetIntensity = 2.6
      targetColor = COLORS.arc
    } else if (frame.energized) {
      targetIntensity = 1.15
      targetColor = COLORS.energized
    }

    const mat = matRef.current
    if (mat) {
      const k = Math.min(1, delta * 9)
      anim.current.intensity += (targetIntensity - anim.current.intensity) * k
      mat.emissiveIntensity = anim.current.intensity
      tmpColor.set(targetColor)
      mat.emissive.lerp(tmpColor, k)
      mat.color.lerp(tmpColor, Math.min(1, delta * 6))
    }
  })

  return (
    <mesh ref={meshRef}>
      <tubeGeometry args={[curve, 32, radius, 8, false]} />
      <meshStandardMaterial
        ref={matRef}
        color={COLORS.deenergized}
        emissive={COLORS.deenergized}
        emissiveIntensity={0.16}
        roughness={0.34}
        metalness={0.6}
        toneMapped={false}
      />
    </mesh>
  )
}
