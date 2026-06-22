import { Canvas, useFrame } from '@react-three/fiber'
import { Sky, ContactShadows } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Maximize2, Minimize2 } from 'lucide-react'
import type { Phase } from '@/simulation/types'
import { faultGeometry } from '@/simulation/runSimulation'
import { getConductor } from '@/simulation/conductorCatalog'
import { useScenarioStore } from '@/state/useScenarioStore'
import { useLayoutStore } from '@/state/useLayoutStore'
import { useThemeStore } from '@/state/useThemeStore'
import { useThemeColors } from '@/theme/useThemeColors'
import { frameAtMs } from '@/utils/frames'
import { clamp } from '@/utils/math'
import { Pole } from './Pole'
import { Crossarm } from './Crossarm'
import { Span } from './Span'
import { Ground } from './Ground'
import { DistantPoles } from './DistantPoles'
import { Skyline } from './Skyline'
import { Cars } from './Cars'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'

const DISP_GAIN = 1.5
const POLE_HEIGHT = 30
const ATTACH_Y = 0
const SPAN_RENDER = 0.165 // ft -> world units along the line

interface Geometry {
  leftSpanU: number
  rightSpanU: number
  centerZ: number
  restX: Record<Phase, number>
  sagU: number
  pair: { a: Phase; b: Phase }
  isPair: boolean
  participates: (p: Phase) => boolean
  diameterIn: number
}

/** Scene content wrapped in a group that shakes briefly on a slap (either span). */
function SceneContent({ g }: { g: Geometry }) {
  const groupRef = useRef<THREE.Group>(null)
  const result = useScenarioStore((s) => s.result)
  const witnessFrames = useScenarioStore((s) => s.witnessFrames)

  useFrame(() => {
    const st = useScenarioStore.getState()
    const primary = frameAtMs(st.result, st.cursorMs)
    const slap = primary.contact === 'contact'
    if (groupRef.current) {
      const shake = slap ? 0.07 : 0
      groupRef.current.position.x = (Math.random() - 0.5) * shake
      groupRef.current.position.y = (Math.random() - 0.5) * shake
    }
  })

  const shared = {
    restX: g.restX,
    attachY: ATTACH_Y,
    sagU: g.sagU,
    dispGain: DISP_GAIN,
    pair: g.pair,
    isPair: g.isPair,
    participates: g.participates,
    diameterIn: g.diameterIn,
    dtMs: result.dtMs,
  }

  return (
    <group ref={groupRef}>
      <Pole z={-g.leftSpanU} height={POLE_HEIGHT} />
      <Pole z={0} height={POLE_HEIGHT} />
      <Pole z={g.rightSpanU} height={POLE_HEIGHT} />
      <Crossarm z={-g.leftSpanU} spacingU={g.restX.C} restX={g.restX} />
      <Crossarm z={0} spacingU={g.restX.C} restX={g.restX} />
      <Crossarm z={g.rightSpanU} spacingU={g.restX.C} restX={g.restX} />

      {/* Faulted (instrumented) span — left */}
      <Span z0={-g.leftSpanU} z1={0} frames={result.frames} {...shared} />
      {/* Adjacent comparison span — right */}
      <Span z0={0} z1={g.rightSpanU} frames={witnessFrames} {...shared} />
    </group>
  )
}

export function DistributionScene() {
  const scenario = useScenarioStore((s) => s.scenario)
  const mode = useScenarioStore((s) => s.mode)
  const palette = useThemeColors()
  const isDark = useThemeStore((s) => s.resolved === 'dark')
  const sceneExpanded = useLayoutStore((s) => s.sceneExpanded)
  const toggleSceneExpanded = useLayoutStore((s) => s.toggleSceneExpanded)

  const g = useMemo<Geometry>(() => {
    const spacingU = scenario.phaseSpacingFt
    const restX: Record<Phase, number> = { A: -spacingU, B: 0, C: spacingU }
    const geom = faultGeometry(scenario.faultType)
    const pair = { a: geom.phases[0], b: geom.isPair ? geom.phases[1] : geom.phases[0] }
    const conductor = getConductor(scenario.conductorTypeId)
    const leftSpanU = clamp(scenario.spanLengthFt * SPAN_RENDER, 26, 52)
    const rightSpanU = clamp(scenario.secondSpanLengthFt * SPAN_RENDER, 18, 52)
    return {
      leftSpanU,
      rightSpanU,
      centerZ: (-leftSpanU + rightSpanU) / 2,
      restX,
      sagU: scenario.sagFt,
      pair,
      isPair: geom.isPair,
      participates: (p: Phase) => geom.phases.includes(p),
      diameterIn: conductor.diameterIn,
    }
  }, [
    scenario.phaseSpacingFt,
    scenario.sagFt,
    scenario.faultType,
    scenario.conductorTypeId,
    scenario.spanLengthFt,
    scenario.secondSpanLengthFt,
  ])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-edge bg-scene">
      <Canvas dpr={[1, 1.8]} camera={{ position: [-34, 15, 40], fov: 44, near: 0.1, far: 400 }}>
        <color attach="background" args={[palette.sceneBg]} />
        {/* Lighter fog so the lit skyline reads; still enough haze for depth. */}
        <fog attach="fog" args={[palette.sceneBg, 150, 340]} />

        {/* Physically-based sky dome: bright day in light, warm low-sun dusk in dark. */}
        <Sky
          distance={4500}
          sunPosition={isDark ? [60, 4, -55] : [16, 26, 14]}
          turbidity={isDark ? 12 : 5}
          rayleigh={isDark ? 3.2 : 1.2}
          mieCoefficient={isDark ? 0.02 : 0.006}
          mieDirectionalG={isDark ? 0.93 : 0.8}
        />

        <ambientLight intensity={isDark ? 0.22 : 0.72} />
        <hemisphereLight args={['#9bb4e8', isDark ? '#0a0f17' : '#dfe7f2', isDark ? 0.45 : 0.7]} />
        {/* Warm dusk key from the sun side; cool fill from the opposite side. */}
        <directionalLight position={[40, 12, -30]} intensity={isDark ? 1.25 : 1.0} color={isDark ? '#ffb784' : '#ffffff'} />
        <directionalLight position={[-20, 8, -12]} intensity={isDark ? 0.35 : 0.3} color={isDark ? '#2f5f9e' : '#9db8db'} />

        {/* Street + receding feeder + faded skyline + traffic (all static or instanced). */}
        <Ground centerZ={g.centerZ} />
        <DistantPoles leftSpanU={g.leftSpanU} rightSpanU={g.rightSpanU} spacing={g.restX.C} isDark={isDark} />
        <Skyline centerZ={g.centerZ} isDark={isDark} />
        <Cars centerZ={g.centerZ} isDark={isDark} />
        <ContactShadows
          position={[0, -POLE_HEIGHT + 0.05, g.centerZ]}
          scale={150}
          blur={2.6}
          far={34}
          resolution={512}
          opacity={isDark ? 0.5 : 0.4}
          color={isDark ? '#01040a' : '#1e293b'}
        />

        <SceneContent g={g} />
        <CameraRig mode={mode} targetZ={g.centerZ} />
        <Effects />
      </Canvas>

      {/* overlays */}
      {mode !== 'presentation' && (
        <button
          type="button"
          onClick={toggleSceneExpanded}
          title={sceneExpanded ? 'Restore panels' : 'Expand scene'}
          aria-label={sceneExpanded ? 'Restore panels' : 'Expand scene'}
          aria-pressed={sceneExpanded}
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg border border-edge/60 bg-panel/70 text-fg-muted backdrop-blur transition-colors hover:border-brand hover:text-fg"
        >
          {sceneExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
      )}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-edge/60 bg-panel/70 px-3 py-1.5 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-energized" />
        <span className="text-xs font-medium text-fg-muted">
          {scenario.voltageClassKv} kV · {scenario.faultType} fault · two spans from a center pole
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 max-w-[280px] text-[10px] leading-snug text-fg-faint">
        Left span {scenario.spanLengthFt} ft (faulted) · right span {scenario.secondSpanLengthFt} ft.
        Lateral motion shown at ~{DISP_GAIN}× for clarity.
      </div>
    </div>
  )
}
