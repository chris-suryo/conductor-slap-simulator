import { Bloom, EffectComposer } from '@react-three/postprocessing'

/** Cinematic bloom so energized conductors, force arrows, and arcs glow. */
export function Effects() {
  return (
    <EffectComposer>
      <Bloom intensity={0.85} luminanceThreshold={0.25} luminanceSmoothing={0.9} mipmapBlur />
    </EffectComposer>
  )
}
