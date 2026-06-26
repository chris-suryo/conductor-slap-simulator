import type { ReactNode } from 'react'
import { useScenarioStore } from '@/state/useScenarioStore'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { frameAtMs } from '@/utils/frames'
import { NOMINAL_LOAD_CURRENT_A, REDUCED_LOAD_CURRENT_A } from '@/simulation/constants'
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

/**
 * A closed/open device-state cell with an indicator dot. `partial` shows an amber "1 pole open"
 * state instead of fully open/closed — used for the recloser under single-pole tripping, where
 * the faulted phase opens but the other two stay closed (vs. a three-pole device, which is
 * always fully open or fully closed).
 */
function BreakerStateCell({
  closed,
  openLabel = 'Open',
  partial = false,
}: {
  closed: boolean
  openLabel?: string
  partial?: boolean
}) {
  const label = closed ? 'Closed' : partial ? '1 pole open' : openLabel
  return (
    <div className="panel-muted px-3 py-2">
      <div className="label-eyebrow mb-1">State</div>
      <div className="flex items-center gap-1.5 text-sm font-semibold">
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            closed ? 'bg-energized shadow-glow shadow-energized' : partial ? 'bg-caution' : 'bg-deenergized',
          )}
        />
        <span className={closed ? 'text-energized' : partial ? 'text-caution' : 'text-fg-muted'}>{label}</span>
      </div>
    </div>
  )
}

/** Current flowing through a device: fault (red), load (with suffix), or none. */
function DeviceCurrentCell({ amps, fault, loadSuffix = 'load' }: { amps: number; fault: boolean; loadSuffix?: string }) {
  return (
    <div className="panel-muted px-3 py-2">
      <div className="label-eyebrow mb-1">Current</div>
      <div className="stat-value text-sm font-semibold">
        {amps <= 0 ? (
          <span className="text-fg-muted">—</span>
        ) : fault ? (
          <span className="text-fault">{fmtAmps(amps)}</span>
        ) : (
          <span className="text-fg">
            {fmtAmps(amps)}
            <span className="ml-1 text-[10px] font-normal text-fg-faint">{loadSuffix}</span>
          </span>
        )}
      </div>
    </div>
  )
}

/** Two live device readouts (recloser + substation breaker) that follow the playback cursor. */
function LiveStatus() {
  const cursorMs = useScenarioStore((s) => s.cursorMs)
  const result = useScenarioStore((s) => s.result)
  const frame = frameAtMs(result, cursorMs)
  const meta = STATE_META[frame.state]
  const contact = CONTACT_META[frame.contact]

  const fault = frame.faultActive
  const recloserClosed = frame.energized
  const subClosed = frame.upstreamEnergized
  // Single-pole trip (ground fault, recloser engaged): the faulted phase opens but the other two
  // never lose power — EXCEPT on the final shot before lockout, where the recloser converts to a
  // three-pole trip (see `downstreamHealthyEnergized`). "Partial" (1 pole open) is exactly the
  // case where the faulted pole is open but the healthy phases are still up; that's true for every
  // shot except the final one, without needing to special-case it here.
  const singlePoleTrip = result.singlePoleTrip
  const recloserPartialOpen = !recloserClosed && frame.downstreamHealthyEnergized
  // The fault is downstream of the recloser, so both devices carry the fault current while it is
  // energized. With no fault: the recloser passes the downstream load while closed (or, under
  // single-pole trip, on its two healthy phases even with the faulted pole open); the substation
  // breaker passes full load when the recloser is closed (or its 2 healthy phases are still
  // carrying ~nominal demand) and reduced load once the whole downstream section is open.
  const recloserCurrentA = fault ? frame.currentA : frame.downstreamHealthyEnergized ? NOMINAL_LOAD_CURRENT_A : 0
  const subCurrentA = fault
    ? frame.currentA
    : subClosed
      ? recloserClosed || frame.downstreamHealthyEnergized
        ? NOMINAL_LOAD_CURRENT_A
        : REDUCED_LOAD_CURRENT_A
      : 0

  return (
    <>
      {/* Recloser (downstream device) */}
      <Card>
        <CardHeader
          eyebrow={singlePoleTrip ? 'Live · downstream · single-pole trip' : 'Live · downstream'}
          title="Recloser"
          right={<Badge tone={meta.tone}>{meta.label}</Badge>}
        />
        <div className="grid grid-cols-3 gap-2">
          <BreakerStateCell closed={recloserClosed} partial={recloserPartialOpen} />
          <DeviceCurrentCell amps={recloserCurrentA} fault={fault} />
          <div className="panel-muted px-3 py-2">
            <div className="label-eyebrow mb-1">Clearance</div>
            <div className="stat-value text-sm font-semibold" style={{ color: contact.color }}>
              {fmtFt(Math.max(frame.clearanceFt, 0))}
            </div>
          </div>
        </div>
      </Card>

      {/* Substation feeder breaker (upstream device) */}
      <Card>
        <CardHeader
          eyebrow="Live · upstream"
          title="Substation breaker"
          right={<Badge tone={subClosed ? 'energized' : 'deenergized'}>{subClosed ? 'Closed' : 'Open'}</Badge>}
        />
        <div className="grid grid-cols-2 gap-2">
          <BreakerStateCell closed={subClosed} />
          <DeviceCurrentCell amps={subCurrentA} fault={fault} loadSuffix="src load" />
        </div>
      </Card>
    </>
  )
}

export function ResultsPanel() {
  const result = useScenarioStore((s) => s.result)
  const scenario = useScenarioStore((s) => s.scenario)
  const span1Frames = useScenarioStore((s) => s.span1Frames)
  const span2Frames = useScenarioStore((s) => s.span2Frames)
  const final = FINAL_META[result.finalState]
  const span1Slapped = span1Frames.some((f) => f.contact === 'contact')
  const span2Slapped = span2Frames.some((f) => f.contact === 'contact')
  const span3Slapped = result.slapOccurred
  // The orchestrator picks whichever device operates the PRIMARY fault — the recloser only when
  // it's engaged (downstream fault, recloser enabled); otherwise the substation relay handles it
  // directly on its own curve (mirrors `recloserEngaged` in runSimulation.ts). `result.tripTimeMs`
  // is that single operating device's trip time, so it belongs to whichever stat matches.
  const recloserEngaged = scenario.faultLocation === 'downstream' && scenario.protectionEnabled

  return (
    <div className="side-panel-zoom csim-scroll flex h-full flex-col gap-3 overflow-y-auto pl-1">
      <LiveStatus />

      <Card>
        <CardHeader eyebrow="Result" title="Outcome" right={<Badge tone={final.tone}>{final.label}</Badge>} />
        <p className="mb-3 text-xs leading-relaxed text-fg-muted">{final.blurb}</p>
        {result.upstreamFaultEvent && (
          <p className="mb-3 rounded-lg border border-fault/40 bg-fault/10 px-3 py-2 text-xs leading-relaxed text-fault">
            Induced upstream fault at {fmtMs(result.upstreamFaultEvent.atMs)} — the still-energized
            SPAN {result.upstreamFaultEvent.originSpan} clashed and struck a new fault the recloser
            can&apos;t see. Substation relay{' '}
            {result.upstreamFaultEvent.tripTimeMs == null
              ? 'did not trip.'
              : `tripped in ${fmtMs(result.upstreamFaultEvent.tripTimeMs)} (${result.upstreamFaultEvent.finalState.toLowerCase()}).`}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Stat
            label="Recloser trip"
            value={recloserEngaged && result.tripTimeMs != null ? fmtMs(result.tripTimeMs) : 'No trip'}
          />
          <Stat
            label="Relay trip"
            value={!recloserEngaged && result.tripTimeMs != null ? fmtMs(result.tripTimeMs) : 'NO TRIP'}
          />
          <Stat label="Trips" value={result.numTrips} />
          <Stat label="Max displacement" value={fmtFt(result.maxDisplacementFt)} />
          <Stat
            label="Min clearance"
            value={fmtFt(Math.max(result.minClearanceFt, 0))}
            tone={result.slapOccurred ? 'text-fault' : 'text-fg'}
          />
          <Stat
            label="Span 1"
            value={span1Slapped ? 'YES' : 'NO'}
            tone={span1Slapped ? 'text-fault' : 'text-healthy'}
          />
          <Stat
            label="Span 2"
            value={span2Slapped ? 'YES' : 'NO'}
            tone={span2Slapped ? 'text-fault' : 'text-healthy'}
          />
          <Stat
            label="Span 3"
            value={span3Slapped ? 'YES' : 'NO'}
            tone={span3Slapped ? 'text-fault' : 'text-healthy'}
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
