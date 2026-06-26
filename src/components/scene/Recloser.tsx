import { Html } from '@react-three/drei'
import type { Phase } from '@/simulation/types'

/**
 * A pole-mounted G&W recloser (three-phase switch body with bushings) plus a ground-level
 * control cabinet, installed on the pole at the boundary between the upstream feeder and the
 * faulted downstream span. Geometry is intentionally simple/representative.
 */
export function Recloser({ z, restX }: { z: number; restX: Record<Phase, number> }) {
  const bodyY = -2.2 // hangs just below the crossarm
  const cabinetY = -16 // partway down the pole
  return (
    <group position={[0, 0, z]}>
      {/* recloser tank / switch body */}
      <mesh position={[0, bodyY, 0.6]} castShadow>
        <boxGeometry args={[3.6, 1.5, 1.3]} />
        <meshStandardMaterial color="#36424f" roughness={0.5} metalness={0.65} />
      </mesh>
      {/* three bushings on top of the tank */}
      {(['A', 'B', 'C'] as Phase[]).map((ph) => (
        <mesh key={ph} position={[restX[ph] * 0.42, bodyY + 1.0, 0.6]}>
          <cylinderGeometry args={[0.16, 0.2, 0.85, 10]} />
          <meshStandardMaterial color="#c2cad3" roughness={0.4} metalness={0.3} />
        </mesh>
      ))}
      {/* control cabinet on the pole */}
      <mesh position={[1.15, cabinetY, 0.4]} castShadow>
        <boxGeometry args={[1.7, 2.6, 1.2]} />
        <meshStandardMaterial color="#55626f" roughness={0.6} metalness={0.45} />
      </mesh>
      {/* control conduit down the pole */}
      <mesh position={[0.5, (bodyY + cabinetY) / 2, 0.35]}>
        <cylinderGeometry args={[0.12, 0.12, Math.abs(bodyY - cabinetY), 6]} />
        <meshStandardMaterial color="#2c333b" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* label */}
      <Html position={[0, bodyY + 2.4, 0.6]} center zIndexRange={[18, 0]}>
        <div
          style={{
            pointerEvents: 'none',
            userSelect: 'none',
            fontSize: 54,
            letterSpacing: '0.1em',
            color: '#FD8505',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            textShadow: '0 1px 4px rgba(0,0,0,0.7)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          G&amp;W RECLOSER
        </div>
      </Html>
    </group>
  )
}
