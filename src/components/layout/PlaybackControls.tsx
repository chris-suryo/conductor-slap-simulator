import { Pause, Play, Repeat, RotateCcw } from 'lucide-react'
import { useScenarioStore } from '@/state/useScenarioStore'
import { cn } from '@/utils/cn'
import { fmtMs } from '@/utils/labels'

const SPEEDS = [0.25, 0.5, 1]

const ICON_BTN =
  'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50'

function LiveClock() {
  const cursorMs = useScenarioStore((s) => s.cursorMs)
  const durationMs = useScenarioStore((s) => s.result.durationMs)
  return (
    <span className="stat-value w-[104px] text-right text-xs text-fg-muted">
      {fmtMs(cursorMs)} <span className="text-fg-faint">/ {fmtMs(durationMs)}</span>
    </span>
  )
}

export function PlaybackControls() {
  const playing = useScenarioStore((s) => s.playing)
  const speed = useScenarioStore((s) => s.speed)
  const loop = useScenarioStore((s) => s.loop)
  const togglePlay = useScenarioStore((s) => s.togglePlay)
  const restart = useScenarioStore((s) => s.restart)
  const setSpeed = useScenarioStore((s) => s.setSpeed)
  const toggleLoop = useScenarioStore((s) => s.toggleLoop)

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={restart}
        title="Replay"
        aria-label="Replay"
        className={cn(ICON_BTN, 'border-edge bg-panel-raised text-fg-muted hover:border-edge-bright hover:text-fg')}
      >
        <RotateCcw className="h-4 w-4" />
      </button>
      <button
        onClick={togglePlay}
        title={playing ? 'Pause' : 'Play'}
        aria-label={playing ? 'Pause' : 'Play'}
        className={cn(ICON_BTN, 'border-brand/30 bg-brand/15 text-brand hover:bg-brand/25')}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>

      <button
        onClick={toggleLoop}
        title={loop ? 'Looping — click to stop at end' : 'Play once'}
        aria-label="Toggle loop"
        aria-pressed={loop}
        className={cn(
          ICON_BTN,
          loop
            ? 'border-brand/30 bg-brand/15 text-brand'
            : 'border-edge bg-panel-raised text-fg-muted hover:text-fg',
        )}
      >
        <Repeat className="h-4 w-4" />
      </button>

      <div className="ml-1 inline-flex rounded-lg border border-edge bg-panel-muted p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-medium tabular-nums transition-colors',
              speed === s ? 'bg-panel-raised text-fg shadow-sm' : 'text-fg-faint hover:text-fg-muted',
            )}
          >
            {s}×
          </button>
        ))}
      </div>

      <LiveClock />
    </div>
  )
}
