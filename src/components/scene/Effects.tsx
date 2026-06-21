import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { useThemeStore } from '@/state/useThemeStore'

/** Cinematic bloom so energized conductors, force arrows, and arcs glow. */
export function Effects() {
  const isDark = useThemeStore((s) => s.resolved === 'dark')
  return (
    <EffectComposer>
      <Bloom
        intensity={isDark ? 0.7 : 0.45}
        luminanceThreshold={isDark ? 0.45 : 0.6}
        luminanceSmoothing={0.85}
        mipmapBlur
      />
    </EffectComposer>
  )
}
