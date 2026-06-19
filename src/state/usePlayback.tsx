import { useEffect } from 'react'
import { useScenarioStore } from './useScenarioStore'

/**
 * Single requestAnimationFrame clock that advances the playback cursor. Rendered once
 * near the app root. Consumers (3D scene, charts, timeline) read the cursor imperatively
 * so the heavy views never re-render on the React tree every frame.
 */
export function PlaybackClock() {
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(now - last, 64) // clamp big gaps (tab refocus)
      last = now
      const { playing, speed, advanceCursor } = useScenarioStore.getState()
      if (playing) advanceCursor(dt * speed)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return null
}
