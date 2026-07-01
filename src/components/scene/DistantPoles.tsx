import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Phase, SimulationFrame } from '@/simulation/types'
import { faultGeometry } from '@/simulation/runSimulation'
import { useScenarioStore } from '@/state/useScenarioStore'
import { useThemeColors } from '@/theme/useThemeColors'
import { frameFromArray } from '@/utils/frames'
import { COLORS, SCENE_EMISSIVE } from '@/utils/labels'
import { NEUTRAL_DROP_FT, NEUTRAL_SAG_FT, neutralTarget } from './NeutralConductor'

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
const CONDUCTOR_SAG_U = 3.5 // static decorative sag — these poles have no physics
const CONDUCTOR_RADIUS = 0.13
const CONDUCTOR_CORE_RADIUS = CONDUCTOR_RADIUS * 0.35
const NEUTRAL_RADIUS = 0.085
const NEUTRAL_CORE_RADIUS = NEUTRAL_RADIUS * 0.35
const NEUTRAL_Y = TOP_Y - NEUTRAL_DROP_FT

/** A static sagging tube through every pole on one side, starting at the instrumented span's
 * boundary pole — its SHAPE never animates (geometry built once), only its color does. Dips at
 * each midspan the same way `Conductor.tsx`'s curve does. `yBase`/`sag` let the neutral wire
 * reuse this at its own (lower attach height, smaller sag). */
function feederCurve(
  boundaryZ: number,
  poleZs: number[],
  x: number,
  yBase = TOP_Y,
  sag = CONDUCTOR_SAG_U,
): THREE.CatmullRomCurve3 {
  const pts: THREE.Vector3[] = [new THREE.Vector3(x, yBase, boundaryZ)]
  let prevZ = boundaryZ
  for (const z of poleZs) {
    pts.push(new THREE.Vector3(x, yBase - sag, (prevZ + z) / 2))
    pts.push(new THREE.Vector3(x, yBase, z))
    prevZ = z
  }
  return new THREE.CatmullRomCurve3(pts)
}

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

/**
 * One background feeder conductor: same color logic as `Conductor.tsx` (dim metallic body +
 * bright core tube, energized cyan / fault-hot / de-energized dim) driven by the SAME frame
 * series as whichever instrumented span it continues from — but its tube geometry is static
 * (no displacement), so the per-frame work here is only a couple of color lerps, not a
 * geometry rebuild.
 */
function FeederConductor({
  curve,
  participates,
  frames,
  dtMs,
}: {
  curve: THREE.CatmullRomCurve3
  participates: boolean
  frames: SimulationFrame[]
  dtMs: number
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const tmpColor = useMemo(() => new THREE.Color(), [])
  const tubularSegments = (curve.points.length - 1) * 8

  useFrame((_, delta) => {
    const cursorMs = useScenarioStore.getState().cursorMs
    const frame = frameFromArray(frames, dtMs, cursorMs)
    let targetIntensity = 0.12
    let targetColor: string = COLORS.deenergized
    const live = participates && frame.faultActive
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
      mat.emissiveIntensity += (targetIntensity - mat.emissiveIntensity) * k
      tmpColor.set(targetColor)
      mat.emissive.lerp(tmpColor, k)
      mat.color.lerp(tmpColor, Math.min(1, delta * 6))
    }

    if (coreRef.current && coreMatRef.current) {
      const on = live || poleEnergized
      coreRef.current.visible = on
      if (on) {
        coreMatRef.current.color.lerp(tmpColor.set(live ? COLORS.arc : COLORS.energized), Math.min(1, delta * 8))
      }
    }
  })

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, tubularSegments, CONDUCTOR_RADIUS, 8, false]} />
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
        <tubeGeometry args={[curve, tubularSegments, CONDUCTOR_CORE_RADIUS, 6, false]} />
        <meshBasicMaterial ref={coreMatRef} color={COLORS.energized} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** The background neutral wire — same idea as `FeederConductor`, colored via the shared
 * `neutralTarget` helper from `NeutralConductor.tsx` so it reads identically to the
 * instrumented spans' own neutral. */
function FeederNeutral({
  curve,
  isGroundFault,
  frames,
  dtMs,
}: {
  curve: THREE.CatmullRomCurve3
  isGroundFault: boolean
  frames: SimulationFrame[]
  dtMs: number
}) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null)
  const coreRef = useRef<THREE.Mesh>(null)
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const tmpColor = useMemo(() => new THREE.Color(), [])
  const tubularSegments = (curve.points.length - 1) * 8

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
        <tubeGeometry args={[curve, tubularSegments, NEUTRAL_RADIUS, 8, false]} />
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
        <tubeGeometry args={[curve, tubularSegments, NEUTRAL_CORE_RADIUS, 6, false]} />
        <meshBasicMaterial ref={coreMatRef} color={COLORS.energized} toneMapped={false} />
      </mesh>
    </group>
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

  // Same energization source as the instrumented spans they continue from: the LEFT side
  // mirrors whatever drives SPAN 1 (upstream of the recloser), the RIGHT side mirrors whatever
  // drives SPAN 3 (downstream) — so the recloser tripping only darkens the downstream/right
  // side, while the substation breaker opening darkens both sides together. `runSimulation`'s
  // `activeSpanLengthFt` swaps which array is the "real" instrumented physics for an upstream
  // fault (SPAN 1 instead of SPAN 3), so mirror that same swap here.
  const result = useScenarioStore((s) => s.result)
  const span1Frames = useScenarioStore((s) => s.span1Frames)
  const span2Frames = useScenarioStore((s) => s.span2Frames)
  const faultLocation = useScenarioStore((s) => s.scenario.faultLocation)
  const faultType = useScenarioStore((s) => s.scenario.faultType)
  const faultUpstream = faultLocation === 'upstream'
  const leftFrames = faultUpstream ? result.frames : span1Frames
  const rightFrames = faultUpstream ? span2Frames : result.frames
  const phases = useMemo(() => faultGeometry(faultType).phases, [faultType])
  const isGroundFault = phases.length === 1

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

    // Conductors strung pole-to-pole, end to end — one continuous curve per phase per side,
    // starting at the instrumented span's own boundary pole so there's no visible gap.
    const rightZs = Array.from({ length: PER_SIDE }, (_, k) => rightSpanU + (k + 1) * SPACING)
    const leftZs = Array.from({ length: PER_SIDE }, (_, k) => -leftSpanU - (k + 1) * SPACING)
    const phasesXOrder: { phase: Phase; x: number }[] = [
      { phase: 'A', x: -spacing },
      { phase: 'B', x: 0 },
      { phase: 'C', x: spacing },
    ]
    const leftCurves = phasesXOrder.map(({ phase, x }) => ({
      phase,
      curve: feederCurve(-leftSpanU, leftZs, x),
    }))
    const rightCurves = phasesXOrder.map(({ phase, x }) => ({
      phase,
      curve: feederCurve(rightSpanU, rightZs, x),
    }))
    // Neutral wire, 6 ft below the middle phase — same end-to-end treatment as the phases.
    const leftNeutralCurve = feederCurve(-leftSpanU, leftZs, 0, NEUTRAL_Y, NEUTRAL_SAG_FT)
    const rightNeutralCurve = feederCurve(rightSpanU, rightZs, 0, NEUTRAL_Y, NEUTRAL_SAG_FT)

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
    return {
      poles,
      arms,
      insulators,
      lampArms,
      lampHeads,
      lampLightPositions,
      transformerZ,
      leftCurves,
      rightCurves,
      leftNeutralCurve,
      rightNeutralCurve,
    }
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
      {/* conductors — static sagging tubes, colored/live exactly like the instrumented spans */}
      {built.leftCurves.map(({ curve, phase }) => (
        <FeederConductor
          key={`l-${phase}`}
          curve={curve}
          participates={phases.includes(phase)}
          frames={leftFrames}
          dtMs={result.dtMs}
        />
      ))}
      {built.rightCurves.map(({ curve, phase }) => (
        <FeederConductor
          key={`r-${phase}`}
          curve={curve}
          participates={phases.includes(phase)}
          frames={rightFrames}
          dtMs={result.dtMs}
        />
      ))}
      {/* neutral — 6 ft below the middle phase, end to end */}
      <FeederNeutral curve={built.leftNeutralCurve} isGroundFault={isGroundFault} frames={leftFrames} dtMs={result.dtMs} />
      <FeederNeutral curve={built.rightNeutralCurve} isGroundFault={isGroundFault} frames={rightFrames} dtMs={result.dtMs} />
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
