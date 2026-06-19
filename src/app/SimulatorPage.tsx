import { Shell } from '@/components/layout/Shell'
import { PlaybackClock } from '@/state/usePlayback'

export function SimulatorPage() {
  return (
    <>
      <PlaybackClock />
      <Shell />
    </>
  )
}
