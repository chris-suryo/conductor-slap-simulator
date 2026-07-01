import { Html } from '@react-three/drei'

/**
 * A billboarded "LOAD SIDE" label marking the remote end of the span downstream of the
 * recloser — same color/style as `SourceMarker`'s "SOURCE SIDE" text, just without the circular
 * badge (not requested). Rendered as a drei <Html> overlay so it stays readable at any orbit
 * angle, mirroring SourceMarker's placement convention.
 */
export function LoadSideMarker({ z, y = 4 }: { z: number; y?: number }) {
  return (
    <Html position={[0, y, z]} center zIndexRange={[20, 0]}>
      <div
        style={{
          fontSize: 54,
          letterSpacing: '0.14em',
          color: '#FD8505',
          fontWeight: 600,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          textShadow: '0 1px 4px rgba(0,0,0,0.7)',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        LOAD SIDE
      </div>
    </Html>
  )
}
