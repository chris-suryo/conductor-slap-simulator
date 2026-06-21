import { useEffect, useMemo, useRef } from 'react'
import type { ProtectionState } from '@/simulation/types'
import { useScenarioStore } from '@/state/useScenarioStore'
import { Badge } from '@/components/ui/Badge'
import { frameAtMs } from '@/utils/frames'
import { EVENT_COLOR, STATE_META, fmtMs } from '@/utils/labels'
import { clamp } from '@/utils/math'

interface Segment {
  state: ProtectionState
  startMs: number
  endMs: number
}

const SHORT_KIND: Record<string, string> = {
  normal: 'Normal',
  fault: 'Fault',
  trip: 'Trip',
  open: 'Open',
  reclose: 'Reclose',
  restored: 'Restored',
  lockout: 'Lockout',
  slap: 'Slap',
}

function LivePhaseBadge() {
  const cursorMs = useScenarioStore((s) => s.cursorMs)
  const result = useScenarioStore((s) => s.result)
  const frame = frameAtMs(result, cursorMs)
  const meta = STATE_META[frame.state]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

export function TimelinePanel() {
  const result = useScenarioStore((s) => s.result)
  const seek = useScenarioStore((s) => s.seek)
  const trackRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)

  const segments = useMemo<Segment[]>(() => {
    const frames = result.frames
    if (!frames.length) return []
    const segs: Segment[] = []
    let cur: Segment = { state: frames[0].state, startMs: frames[0].tMs, endMs: frames[0].tMs }
    for (let i = 1; i < frames.length; i++) {
      const f = frames[i]
      if (f.state === cur.state) cur.endMs = f.tMs
      else {
        segs.push(cur)
        cur = { state: f.state, startMs: f.tMs, endMs: f.tMs }
      }
    }
    segs.push(cur)
    return segs
  }, [result])

  const dur = Math.max(result.durationMs, 1)

  // Imperative playhead — avoids re-rendering this panel every animation frame.
  useEffect(() => {
    const update = (ms: number, total: number) => {
      if (playheadRef.current) {
        playheadRef.current.style.left = `${clamp((ms / Math.max(total, 1)) * 100, 0, 100)}%`
      }
    }
    const st = useScenarioStore.getState()
    update(st.cursorMs, st.result.durationMs)
    return useScenarioStore.subscribe((s) => update(s.cursorMs, s.result.durationMs))
  }, [])

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = clamp((e.clientX - rect.left) / rect.width, 0, 1)
    seek(pct * dur)
  }

  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="label-eyebrow">Protection sequence</div>
        <LivePhaseBadge />
      </div>

      <div
        ref={trackRef}
        onClick={handleSeek}
        className="relative h-12 cursor-pointer overflow-hidden rounded-lg border border-edge bg-panel-muted"
      >
        {/* phase segments */}
        {segments.map((seg, i) => {
          const left = (seg.startMs / dur) * 100
          const width = Math.max(((seg.endMs - seg.startMs) / dur) * 100, 0.4)
          const color = STATE_META[seg.state].color
          return (
            <div
              key={i}
              className="absolute top-0 h-full"
              style={{
                left: `${left}%`,
                width: `${width}%`,
                backgroundColor: `${color}1f`,
                borderTop: `2px solid ${color}`,
              }}
              title={STATE_META[seg.state].label}
            />
          )
        })}

        {/* event ticks */}
        {result.events.map((ev, i) => {
          const left = (ev.tMs / dur) * 100
          const color = EVENT_COLOR[ev.kind]
          return (
            <div
              key={i}
              className="absolute top-0 h-full w-px"
              style={{ left: `${left}%`, backgroundColor: color }}
              title={`${fmtMs(ev.tMs)} · ${ev.label}`}
            >
              <span
                className="absolute -top-0 left-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                style={{ backgroundColor: color }}
              />
            </div>
          )
        })}

        {/* playhead */}
        <div
          ref={playheadRef}
          className="pointer-events-none absolute top-0 z-10 h-full w-0.5 -translate-x-1/2 bg-[rgb(var(--playhead))]"
          style={{ left: '0%', boxShadow: '0 0 8px rgb(var(--playhead) / 0.5)' }}
        />
      </div>

      {/* event chips */}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {result.events.map((ev, i) => (
          <button
            key={i}
            onClick={() => seek(ev.tMs)}
            className="group flex items-center gap-1.5 text-[11px] text-fg-muted transition-colors hover:text-fg"
            title={ev.detail}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: EVENT_COLOR[ev.kind] }} />
            <span className="stat-value text-fg-faint group-hover:text-fg-muted">{fmtMs(ev.tMs)}</span>
            <span>{SHORT_KIND[ev.kind] ?? ev.kind}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
