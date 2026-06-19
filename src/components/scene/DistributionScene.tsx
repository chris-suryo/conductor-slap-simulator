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
import { Conductor } from './Conductor'
import { ForceArrows } from './ForceArrows'
import { MagneticFieldRings } from './MagneticFieldRings'
import { FaultArc } from './FaultArc'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'

const DISP_GAIN = 1.2
const POLE_HEIGHT = 30
const ATTACH_Y = 0

interface Geometry {
  spacingU: number
  spanU: number
  sagU: number
  restX: Record<Phase, number>
  pair: { a: Phase; b: Phase }
  isPair: boolean
  participates: (p: Phase) => boolean
  diameterIn: number
}

/** Scene content wrapped in a group that shakes briefly on a slap. */
function SceneContent({ g }: { g: Geometry }) {
  const groupRef = useRef<THREE.Group>(null)
  const halfSpan = g.spanU / 2

  useFrame(() => {
    const st = useScenarioStore.getState()
    const frame = frameAtMs(st.result, st.cursorMs)
    if (groupRef.current) {
      const shake = frame.contact === 'contact' ? 0.07 : 0
      groupRef.current.position.x = (Math.random() - 0.5) * shake
      groupRef.current.position.y = (Math.random() - 0.5) * shake
    }
  })

  return (
    <group ref={groupRef}>
      <Pole z={-halfSpan} height={POLE_HEIGHT} />
      <Pole z={halfSpan} height={POLE_HEIGHT} />
      <Crossarm z={-halfSpan} spacingU={g.spacingU} restX={g.restX} />
      <Crossarm z={halfSpan} spacingU={g.spacingU} restX={g.restX} />

      {(['A', 'B', 'C'] as Phase[]).map((ph) => (
        <Conductor
          key={ph}
          phase={ph}
          restX={g.restX[ph]}
          spanU={g.spanU}
          attachY={ATTACH_Y}
          sagU={g.sagU}
          dispGain={DISP_GAIN}
          participates={g.participates(ph)}
          diameterIn={g.diameterIn}
        />
      ))}

      <ForceArrows
        pair={g.pair}
        restX={g.restX}
        attachY={ATTACH_Y}
        sagU={g.sagU}
        dispGain={DISP_GAIN}
        enabled={g.isPair}
      />
      <MagneticFieldRings
        pair={g.pair}
        isPair={g.isPair}
        restX={g.restX}
        attachY={ATTACH_Y}
        sagU={g.sagU}
        dispGain={DISP_GAIN}
      />
      {g.isPair && (
        <FaultArc pair={g.pair} restX={g.restX} attachY={ATTACH_Y} sagU={g.sagU} dispGain={DISP_GAIN} />
      )}
    </group>
  )
}

export function DistributionScene() {
  const scenario = useScenarioStore((s) => s.scenario)
  const mode = useScenarioStore((s) => s.mode)

  const g = useMemo<Geometry>(() => {
    const spacingU = scenario.phaseSpacingFt
    const spanU = clamp(scenario.spanLengthFt * 0.18, 28, 56)
    const sagU = scenario.sagFt
    const restX: Record<Phase, number> = { A: -spacingU, B: 0, C: spacingU }
    const geom = faultGeometry(scenario.faultType)
    const pair = { a: geom.phases[0], b: geom.isPair ? geom.phases[1] : geom.phases[0] }
    const conductor = getConductor(scenario.conductorTypeId)
    return {
      spacingU,
      spanU,
      sagU,
      restX,
      pair,
      isPair: geom.isPair,
      participates: (p: Phase) => geom.phases.includes(p),
      diameterIn: conductor.diameterIn,
    }
  }, [scenario.phaseSpacingFt, scenario.spanLengthFt, scenario.sagFt, scenario.faultType, scenario.conductorTypeId])

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-edge bg-[#080f1a]">
      <Canvas dpr={[1, 1.8]} camera={{ position: [-23, 9, 30], fov: 42, near: 0.1, far: 400 }}>
        <color attach="background" args={['#080f1a']} />
        <fog attach="fog" args={['#080f1a', 58, 135]} />

        <ambientLight intensity={0.28} />
        <hemisphereLight args={['#bcd5ff', '#0a0f17', 0.55]} />
        <directionalLight position={[16, 26, 14]} intensity={1.1} color="#d6e6ff" />
        <directionalLight position={[-20, 8, -12]} intensity={0.4} color="#3b6fb0" />

        <gridHelper args={[150, 50, '#23394f', '#0f1a26']} position={[0, -POLE_HEIGHT, 0]} />

        <SceneContent g={g} />
        <CameraRig mode={mode} />
        <Effects />
      </Canvas>

      {/* overlays */}
      <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-edge/60 bg-panel/70 px-3 py-1.5 backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-energized" />
        <span className="text-xs font-medium text-slate-300">
          {scenario.voltageClassKv} kV · {scenario.faultType} fault · midspan view
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] leading-snug text-slate-500">
        Looking along the span. Lateral conductor motion shown at ~{DISP_GAIN}× for clarity.
      </div>
    </div>
  )
}
