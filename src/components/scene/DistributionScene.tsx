import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Phase } from '@/simulation/types'
import { faultGeometry } from '@/simulation/runSimulation'
import { getConductor } from '@/simulation/conductorCatalog'
import { useScenarioStore } from '@/state/useScenarioStore'
import { frameAtMs } from '@/utils/frames'
import { clamp } from '@/utils/math'
import { Pole } from './Pole'
import { Crossarm } from './Crossarm'
import { Span } from './Span'
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
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-edge bg-[#080f1a]">
      <Canvas dpr={[1, 1.8]} camera={{ position: [-34, 15, 40], fov: 44, near: 0.1, far: 400 }}>
        <color attach="background" args={['#080f1a']} />
        <fog attach="fog" args={['#080f1a', 70, 165]} />

        <ambientLight intensity={0.28} />
        <hemisphereLight args={['#bcd5ff', '#0a0f17', 0.55]} />
        <directionalLight position={[16, 26, 14]} intensity={1.1} color="#d6e6ff" />
        <directionalLight position={[-20, 8, -12]} intensity={0.4} color="#3b6fb0" />

        <gridHelper args={[180, 60, '#23394f', '#0f1a26']} position={[0, -POLE_HEIGHT, g.centerZ]} />

        <SceneContent g={g} />
        <CameraRig mode={mode} targetZ={g.centerZ} />
        <Effects />
      </Canvas>

      {/* overlays */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-edge/60 bg-panel/70 px-3 py-1.5 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-energized" />
        <span className="text-xs font-medium text-slate-300">
          {scenario.voltageClassKv} kV · {scenario.faultType} fault · two spans from a center pole
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 max-w-[280px] text-[10px] leading-snug text-slate-500">
        Left span {scenario.spanLengthFt} ft (faulted) · right span {scenario.secondSpanLengthFt} ft.
        Lateral motion shown at ~{DISP_GAIN}× for clarity.
      </div>
    </div>
  )
}
