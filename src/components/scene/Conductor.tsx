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
  const coreRef = useRef<THREE.Mesh>(null)
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const radius = 0.1 + diameterIn * 0.06
  const coreRadius = radius * 0.35 // bright filament down the conductor centre
  const midZ = (z0 + z1) / 2
  // Per-phase phase offset so the idle "breeze" sway isn't in lockstep.
  const phaseSeed = phase === 'A' ? 0 : phase === 'B' ? 2.1 : 4.2

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
  const anim = useRef({ lastDisp: Number.POSITIVE_INFINITY, intensity: 0.12 })
  const tmpColor = useMemo(() => new THREE.Color(), [])

  useFrame((state, delta) => {
    const cursorMs = useScenarioStore.getState().cursorMs
    const frame = frameFromArray(frames, dtMs, cursorMs)
    const dispFt = phase === 'A' ? frame.dispAFt : phase === 'B' ? frame.dispBFt : frame.dispCFt
    const disp = dispFt * dispGain

    // Render-only idle "breeze": a tiny sway when nothing is happening. Never written back
    // into the frames data (the charts read that); suppressed the instant a fault/contact appears.
    const idle =
      !frame.faultActive && frame.contact === 'safe'
        ? Math.sin(state.clock.elapsedTime * 0.6 + phaseSeed) * 0.04
        : 0
    const dispRender = disp + idle

    if (meshRef.current && coreRef.current && Math.abs(dispRender - anim.current.lastDisp) > 0.0015) {
      anim.current.lastDisp = dispRender
      curve.points[0].set(restX, attachY, z0)
      curve.points[1].set(restX + dispRender, attachY - sagU, midZ)
      curve.points[2].set(restX, attachY, z1)
      const geo = new THREE.TubeGeometry(curve, 32, radius, 8, false)
      meshRef.current.geometry.dispose()
      meshRef.current.geometry = geo
      const coreGeo = new THREE.TubeGeometry(curve, 32, coreRadius, 6, false)
      coreRef.current.geometry.dispose()
      coreRef.current.geometry = coreGeo
    }

    // Dimmer, metallic body emissive (energized = cyan, fault = hot). The glow lives in the core.
    let targetIntensity = 0.12
    let targetColor: string = COLORS.deenergized
    const live = participates && frame.faultActive
    // Non-faulted phases stay lit through a single-pole recloser trip; only the faulted
    // phase(s) go dark (all phases go dark together once lockout converts the trip to 3-pole).
    const poleEnergized = participates ? frame.energized : frame.downstreamHealthyEnergized
    if (live) {
      targetIntensity = 2.2
      targetColor = COLORS.arc
    } else if (poleEnergized) {
      targetIntensity = 0.55
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

    // Bright core: visible only when energized/faulted; carries the bloom.
    if (coreRef.current && coreMatRef.current) {
      const on = live || poleEnergized
      coreRef.current.visible = on
      if (on) coreMatRef.current.color.lerp(tmpColor.set(live ? COLORS.arc : COLORS.energized), Math.min(1, delta * 8))
    }
  })

  return (
    <group>
      <mesh ref={meshRef}>
        <tubeGeometry args={[curve, 32, radius, 8, false]} />
        <meshStandardMaterial
          ref={matRef}
          color={COLORS.deenergized}
          emissive={COLORS.deenergized}
          emissiveIntensity={0.12}
          roughness={0.3}
          metalness={0.75}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coreRef} visible={false}>
        <tubeGeometry args={[curve, 32, coreRadius, 6, false]} />
        <meshBasicMaterial ref={coreMatRef} color={COLORS.energized} toneMapped={false} />
      </mesh>
    </group>
  )
}
