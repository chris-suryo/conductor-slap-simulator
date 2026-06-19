import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Phase } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { frameAtMs } from '@/utils/frames'
import { COLORS } from '@/utils/labels'

interface ConductorProps {
  phase: Phase
  restX: number
  spanU: number
  attachY: number
  sagU: number
  dispGain: number
  participates: boolean
  diameterIn: number
}

/**
 * A sagging conductor rendered as a tube through [pole, displaced-midspan, pole].
 * The midspan lateral position is read from the simulation frame each animation frame;
 * the material glows when energized and turns hot during an active fault.
 */
export function Conductor({
  phase,
  restX,
  spanU,
  attachY,
  sagU,
  dispGain,
  participates,
  diameterIn,
}: ConductorProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const radius = 0.1 + diameterIn * 0.06

  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(restX, attachY, -spanU / 2),
        new THREE.Vector3(restX, attachY - sagU, 0),
        new THREE.Vector3(restX, attachY, spanU / 2),
      ]),
    [restX, attachY, spanU, sagU],
  )

  const anim = useRef({ lastDisp: Number.NaN, intensity: 0.16 })
  const tmpColor = useMemo(() => new THREE.Color(), [])

  useFrame((_, delta) => {
    const st = useScenarioStore.getState()
    const frame = frameAtMs(st.result, st.cursorMs)
    const dispFt = phase === 'A' ? frame.dispAFt : phase === 'B' ? frame.dispBFt : frame.dispCFt
    const disp = dispFt * dispGain

    // Rebuild the tube only when the midspan has actually moved.
    if (meshRef.current && Math.abs(disp - anim.current.lastDisp) > 0.0015) {
      anim.current.lastDisp = disp
      curve.points[0].set(restX, attachY, -spanU / 2)
      curve.points[1].set(restX + disp, attachY - sagU, 0)
      curve.points[2].set(restX, attachY, spanU / 2)
      const geo = new THREE.TubeGeometry(curve, 32, radius, 8, false)
      meshRef.current.geometry.dispose()
      meshRef.current.geometry = geo
    }

    // Material target by state.
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
