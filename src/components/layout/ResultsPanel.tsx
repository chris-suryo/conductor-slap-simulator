import type { ReactNode } from 'react'
import { useScenarioStore } from '@/state/useScenarioStore'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { frameAtMs } from '@/utils/frames'
import { NOMINAL_LOAD_CURRENT_A } from '@/simulation/constants'
import {
  CONTACT_META,
  FINAL_META,
  STATE_META,
  fmtAmps,
  fmtFt,
  fmtMs,
} from '@/utils/labels'
import { cn } from '@/utils/cn'

function Stat({
  label,
  value,
  tone = 'text-fg',
}: {
  label: string
  value: ReactNode
  tone?: string
}) {
  return (
    <div className="panel-muted px-3 py-2">
      <div className="label-eyebrow mb-1">{label}</div>
      <div className={cn('stat-value text-sm font-semibold', tone)}>{value}</div>
    </div>
  )
}

/** Live readout that follows the playback cursor. */
function LiveStatus() {
  const cursorMs = useScenarioStore((s) => s.cursorMs)
  const result = useScenarioStore((s) => s.result)
  const frame = frameAtMs(result, cursorMs)
  const meta = STATE_META[frame.state]
  const contact = CONTACT_META[frame.contact]

  return (
    <Card>
      <CardHeader eyebrow="Live state" title="Now playing" right={<Badge tone={meta.tone}>{meta.label}</Badge>} />
      <div className="grid grid-cols-3 gap-2">
        <div className="panel-muted px-3 py-2">
          <div className="label-eyebrow mb-1">Line</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <span
              className={cn(
                'h-2 w-2 rounded-full',
                frame.energized ? 'bg-energized shadow-glow shadow-energized' : 'bg-deenergized',
              )}
            />
            <span className={frame.energized ? 'text-energized' : 'text-fg-muted'}>
              {frame.energized ? 'Energized' : 'Open'}
            </span>
          </div>
        </div>
        <div className="panel-muted px-3 py-2">
          <div className="label-eyebrow mb-1">Current</div>
          <div className="stat-value text-sm font-semibold">
            {frame.faultActive ? (
              <span className="text-fault">{fmtAmps(frame.currentA)}</span>
            ) : frame.energized ? (
              <span className="text-fg">
                {fmtAmps(NOMINAL_LOAD_CURRENT_A)}
                <span className="ml-1 text-[10px] font-normal text-fg-faint">load</span>
              </span>
            ) : (
              <span className="text-fg-muted">—</span>
            )}
          </div>
        </div>
        <div className="panel-muted px-3 py-2">
          <div className="label-eyebrow mb-1">Clearance</div>
          <div className="stat-value text-sm font-semibold" style={{ color: contact.color }}>
            {fmtFt(Math.max(frame.clearanceFt, 0))}
          </div>
        </div>
      </div>
    </Card>
  )
}

export function ResultsPanel() {
  const result = useScenarioStore((s) => s.result)
  const final = FINAL_META[result.finalState]
  const slapTone = result.slapOccurred ? 'text-fault' : 'text-healthy'

  return (
    <div className="csim-scroll flex h-full flex-col gap-3 overflow-y-auto pl-1">
      <LiveStatus />

      <Card>
        <CardHeader eyebrow="Result" title="Outcome" right={<Badge tone={final.tone}>{final.label}</Badge>} />
        <p className="mb-3 text-xs leading-relaxed text-fg-muted">{final.blurb}</p>
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Relay trip"
            value={result.tripTimeMs == null ? 'No trip' : fmtMs(result.tripTimeMs)}
          />
          <Stat label="Trips" value={result.numTrips} />
          <Stat label="Max displacement" value={fmtFt(result.maxDisplacementFt)} />
          <Stat
            label="Min clearance"
            value={fmtFt(Math.max(result.minClearanceFt, 0))}
            tone={result.slapOccurred ? 'text-fault' : 'text-fg'}
          />
          <Stat
            label="Slap"
            value={result.slapOccurred ? 'Yes' : 'No'}
            tone={slapTone}
          />
          <Stat
            label="Slap time"
            value={result.slapTimeMs == null ? '—' : fmtMs(result.slapTimeMs)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader eyebrow="Teaching note" title="What to watch" />
        <ul className="space-y-2 text-xs leading-relaxed text-fg-muted">
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-fault" />
            Fault current drives the conductors apart — force grows with current².
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-caution" />
            The breaker opens, but the conductors keep swinging in silence.
          </li>
          <li className="flex gap-2">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-energized" />
            On reclose, a clear span restores — a still-close span re-strikes.
          </li>
        </ul>
      </Card>
    </div>
  )
}
