import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { SimulationFrame } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { frameFromArray } from '@/utils/frames'
import { COLORS } from '@/utils/labels'

/** Vertical drop below the phase conductors' attach height (ft == world units here). */
export const NEUTRAL_DROP_FT = 8
/** The neutral's own sag — fixed, independent of the phases' `sagU` (it carries no fault load). */
export const NEUTRAL_SAG_FT = 2.5
const RADIUS = 0.085 // a bit thinner than a phase conductor
const CORE_RADIUS = RADIUS * 0.35

/** A lighter tint of the energized cyan — the neutral's normal (load-carrying) look, distinct
 * from a phase conductor's full-intensity energized glow. Shared with the static background
 * feeder neutral in DistantPoles.tsx so both read identically. */
export const NEUTRAL_LIGHT_ENERGIZED = `#${new THREE.Color(COLORS.energized).lerp(new THREE.Color('#ffffff'), 0.6).getHexString()}`

/** Target (color, emissive intensity) for a neutral conductor at a given instant: hot/faulted
 * color when a ground fault is actually returning current through it, a light energized tint
 * while the circuit carries normal load, otherwise the same dim de-energized look as a phase
 * conductor. Shared by the per-span `NeutralConductor` and the static background feeder neutral. */
export function neutralTarget(
  frame: SimulationFrame,
  isGroundFault: boolean,
): { color: string; intensity: number } {
  if (isGroundFault && frame.faultActive) return { color: COLORS.arc, intensity: 2.0 }
  if (frame.energized) return { color: NEUTRAL_LIGHT_ENERGIZED, intensity: 0.3 }
  return { color: COLORS.deenergized, intensity: 0.1 }
}

interface NeutralConductorProps {
  /** X position of the middle phase (always 0 in this app's fixed A/B/C layout). */
  restX: number
  z0: number
  z1: number
  attachY: number
  /** True for a single-phase ground fault (AG/BG/CG) — the only fault type whose current
   * actually returns through the neutral. */
  isGroundFault: boolean
  frames: SimulationFrame[]
  dtMs: number
}

/**
 * The neutral conductor: strung NEUTRAL_DROP_FT below the phase conductors at every pole, with
 * its own fixed NEUTRAL_SAG_FT sag. It carries no lateral force in this model — its geometry is
 * static — but its color reflects live state: hot/fault-colored while a ground fault's return
 * current flows through it, a light energized tint under normal load, dim when de-energized.
 */
export function NeutralConductor({
  restX,
  z0,
  z1,
  attachY,
  isGroundFault,
  frames,
  dtMs,
}: NeutralConductorProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const tmpColor = useMemo(() => new THREE.Color(), [])
  const neutralY = attachY - NEUTRAL_DROP_FT
  const midZ = (z0 + z1) / 2

  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(restX, neutralY, z0),
        new THREE.Vector3(restX, neutralY - NEUTRAL_SAG_FT, midZ),
        new THREE.Vector3(restX, neutralY, z1),
      ]),
    [restX, neutralY, z0, z1, midZ],
  )

  useFrame((_, delta) => {
    const cursorMs = useScenarioStore.getState().cursorMs
    const frame = frameFromArray(frames, dtMs, cursorMs)
    const { color: targetColor, intensity: targetIntensity } = neutralTarget(frame, isGroundFault)

    const mat = matRef.current
    if (mat) {
      const k = Math.min(1, delta * 9)
      mat.emissiveIntensity += (targetIntensity - mat.emissiveIntensity) * k
      tmpColor.set(targetColor)
      mat.emissive.lerp(tmpColor, k)
      mat.color.lerp(tmpColor, Math.min(1, delta * 6))
    }

    if (coreRef.current && coreMatRef.current) {
      const on = (isGroundFault && frame.faultActive) || frame.energized
      coreRef.current.visible = on
      if (on) coreMatRef.current.color.lerp(tmpColor.set(targetColor), Math.min(1, delta * 8))
    }
  })

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 32, RADIUS, 8, false]} />
        <meshStandardMaterial
          ref={matRef}
          color={COLORS.deenergized}
          emissive={COLORS.deenergized}
          emissiveIntensity={0.1}
          roughness={0.35}
          metalness={0.7}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={coreRef} visible={false}>
        <tubeGeometry args={[curve, 32, CORE_RADIUS, 6, false]} />
        <meshBasicMaterial ref={coreMatRef} color={COLORS.energized} toneMapped={false} />
      </mesh>
    </group>
  )
}
