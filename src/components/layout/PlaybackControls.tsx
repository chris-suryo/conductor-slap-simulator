import { useScenarioStore } from '@/state/useScenarioStore'
import { cn } from '@/utils/cn'
import { fmtMs } from '@/utils/labels'

const SPEEDS = [0.25, 0.5, 1]

function LiveClock() {
  const cursorMs = useScenarioStore((s) => s.cursorMs)
  const durationMs = useScenarioStore((s) => s.result.durationMs)
  return (
    <span className="stat-value w-[104px] text-right text-xs text-slate-400">
      {fmtMs(cursorMs)} <span className="text-slate-600">/ {fmtMs(durationMs)}</span>
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
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-panel-raised text-slate-300 transition-colors hover:border-edge-bright hover:text-slate-100"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none">
          <path
            d="M4 10a6 6 0 106-6V2L6.5 5 10 8V6a4 4 0 11-4 4H4z"
            fill="currentColor"
          />
        </svg>
      </button>
      <button
        onClick={togglePlay}
        title={playing ? 'Pause' : 'Play'}
        className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 bg-brand/15 text-brand transition-colors hover:bg-brand/25"
      >
        {playing ? (
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <rect x="5" y="4" width="3.5" height="12" rx="1" />
            <rect x="11.5" y="4" width="3.5" height="12" rx="1" />
          </svg>
        ) : (
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M6 4.5v11a1 1 0 001.5.87l9-5.5a1 1 0 000-1.74l-9-5.5A1 1 0 006 4.5z" />
          </svg>
        )}
      </button>

      <button
        onClick={toggleLoop}
        title={loop ? 'Looping — click to stop at end' : 'Play once'}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
          loop
            ? 'border-brand/30 bg-brand/15 text-brand'
            : 'border-edge bg-panel-raised text-slate-400 hover:text-slate-200',
        )}
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M4 8a4 4 0 014-4h6l-2-2m2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 12a4 4 0 01-4 4H6l2 2m-2-2 2-2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className="ml-1 inline-flex rounded-lg border border-edge bg-panel-muted p-0.5">
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => setSpeed(s)}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-medium tabular-nums transition-colors',
              speed === s ? 'bg-panel-raised text-slate-100' : 'text-slate-500 hover:text-slate-300',
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
