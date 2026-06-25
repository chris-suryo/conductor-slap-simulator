import { Html } from '@react-three/drei'

/**
 * A billboarded "S" badge marking the SOURCE / substation end of the feeder. Rendered as a drei
 * <Html> overlay so it always faces the camera and stays readable at any orbit angle (it draws
 * over the 3D scene rather than being occluded), satisfying "see the source side regardless of
 * the line orientation."
 */
export function SourceMarker({ z, y = 4 }: { z: number; y?: number }) {
  return (
    <Html position={[0, y, z]} center zIndexRange={[20, 0]}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', userSelect: 'none' }}>
        <div
          style={{
            width: 108,
            height: 108,
            borderRadius: '50%',
            background: '#0C3552',
            border: '6px solid #FD8505',
            color: '#fff',
            fontWeight: 700,
            fontSize: 57,
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.45)',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          S
        </div>
        <div style={{ marginTop: 9, fontSize: 27, letterSpacing: '0.14em', color: '#FD8505', fontWeight: 600, whiteSpace: 'nowrap' }}>
          SOURCE
        </div>
      </div>
    </Html>
  )
}
