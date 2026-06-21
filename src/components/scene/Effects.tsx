import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useThemeStore } from '@/state/useThemeStore'

/** Cinematic bloom so energized conductors, force arrows, and arcs glow. */
export function Effects() {
  const isDark = useThemeStore((s) => s.resolved === 'dark')
  return (
    <EffectComposer>
      <Bloom
        intensity={isDark ? 0.85 : 0.5}
        luminanceThreshold={isDark ? 0.25 : 0.55}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
    </EffectComposer>
  )
}
