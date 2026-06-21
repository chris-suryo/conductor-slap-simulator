import { useThemeColors } from '@/theme/useThemeColors'

/** A wooden distribution pole, modeled from the crossarm (y=0) down to ground. */
export function Pole({ z, height }: { z: number; height: number }) {
  const c = useThemeColors()
  return (
    <group position={[0, 0, z]}>
      <mesh position={[0, -height / 2, 0]}>
        <cylinderGeometry args={[0.42, 0.66, height, 14]} />
        <meshStandardMaterial color={c.scenePole} roughness={0.92} metalness={0.04} />
      </mesh>
    </group>
  )
}
