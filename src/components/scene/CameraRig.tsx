import { OrbitControls } from '@react-three/drei'
import type { ViewMode } from '@/state/useScenarioStore'

/** Orbit controls framed on the conductor midspan; slow auto-rotate in presentation mode. */
export function CameraRig({ mode }: { mode: ViewMode }) {
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      target={[0, -3.5, 0]}
      minDistance={16}
      maxDistance={95}
      maxPolarAngle={Math.PI * 0.54}
      autoRotate={mode === 'presentation'}
      autoRotateSpeed={0.5}
    />
  )
}
