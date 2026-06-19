import { OrbitControls } from '@react-three/drei'
import type { ViewMode } from '@/state/useScenarioStore'

/** Orbit controls framed on the line; slow auto-rotate in presentation mode. */
export function CameraRig({ mode, targetZ = 0 }: { mode: ViewMode; targetZ?: number }) {
  return (
    <OrbitControls
      makeDefault
      enablePan={false}
      target={[0, -3.5, targetZ]}
      minDistance={18}
      maxDistance={120}
      maxPolarAngle={Math.PI * 0.54}
      autoRotate={mode === 'presentation'}
      autoRotateSpeed={0.5}
    />
  )
}
