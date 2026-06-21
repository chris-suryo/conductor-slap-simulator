import type { Phase } from '@/simulation/types'
import { useThemeColors } from '@/theme/useThemeColors'

/** A horizontal crossarm with three insulator posts at the phase positions. */
export function Crossarm({
  z,
  spacingU,
  restX,
}: {
  z: number
  spacingU: number
  restX: Record<Phase, number>
}) {
  const c = useThemeColors()
  const armLength = spacingU * 2 + 1.6
  return (
    <group position={[0, 0, z]}>
      {/* crossarm */}
      <mesh position={[0, 0.58, 0]}>
        <boxGeometry args={[armLength, 0.3, 0.42]} />
        <meshStandardMaterial color={c.sceneCrossarm} roughness={0.7} metalness={0.25} />
      </mesh>
      {/* insulators */}
      {(['A', 'B', 'C'] as Phase[]).map((ph) => (
        <mesh key={ph} position={[restX[ph], 0.27, 0]}>
          <cylinderGeometry args={[0.1, 0.13, 0.56, 10]} />
          <meshStandardMaterial color={c.sceneInsulator} roughness={0.45} metalness={0.15} />
        </mesh>
      ))}
    </group>
  )
}
