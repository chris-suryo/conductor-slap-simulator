import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Maximize2, Minimize2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useScenarioStore } from '@/state/useScenarioStore'
import { inverseTripTimeMs, relayDecisionMs } from '@/simulation/protection'
import { shotConfig } from '@/simulation/recloserSequence'
import { fuseMaxClearMs, fuseMinMeltMs, FUSE_OPTIONS } from '@/simulation/fuseCatalog'
import type { ProtectionSettings } from '@/simulation/types'
import { COLORS } from '@/utils/labels'
import { cn } from '@/utils/cn'
import { useChartTheme } from './useChartData'

/*
 * FUTURE UPGRADE (flagged): this is the prime candidate for swapping Recharts → visx/D3 or
 * uPlot. A publication-grade TCC needs true log-log MINOR gridlines (1-2-3-5 per decade),
 * device instantaneous-element cutoffs, downstream coordination, and shaded coordination
 * margins — all of which Recharts fights us on. Keep it behind this component boundary so a
 * future swap stays local.
 */

const fmtTime = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : `${Math.round(ms)}ms`)
const fmtAmps = (a: number) => (a >= 1000 ? `${+(a / 1000).toFixed(1)}k` : `${Math.round(a)}`)

const X_TICKS = [10, 100, 1000, 3000, 10000, 30000, 100000]
/** Fixed low end of the x-axis (A) — full standard decades, like a real TCC sheet, regardless of
 * where either device's pickup happens to sit. */
const X_AXIS_MIN_A = 10
const X_AXIS_MAX_A = 100_000
/** Y-axis (clearing time) spans 10 ms to 1000 s, like a real TCC sheet. */
const Y_AXIS_MIN_MS = 10
const Y_AXIS_MAX_MS = 1_000_000
const Y_TICKS = [10, 100, 1000, 10000, 100000, 1000000]
/** 5 cycles at 60 Hz, ms — where the fault-current marker dot sits on the vertical line. */
const FAULT_DOT_MS = (5 * 1000) / 60

// Distinct, theme-constant device colors (orange recloser vs dark blue relay).
const RECLOSER_COLOR = COLORS.brand
const RELAY_COLOR = '#00008B'
const FUSE_COLOR = COLORS.healthy
// Darker red than the default fault status color, so the fault-current line reads as bold/dark
// as the recloser curve rather than the lighter pastel red used elsewhere in the app.
const FAULT_LINE_COLOR = '#b91c1c'
// Engineering log-paper green, matching a real coordination-software TCC sheet — bold lines at
// each labeled decade, fine sub-divisions (2-9x) in between.
const GRID_MAJOR = '#86b88a'
const GRID_MINOR = '#7CFC00'

/** Log-decade sub-tick values (2x–9x each power of ten) between min and max, for the fine grid. */
function logMinorTicks(min: number, max: number): number[] {
  const ticks: number[] = []
  let decade = Math.pow(10, Math.floor(Math.log10(min)))
  while (decade < max) {
    for (let m = 2; m <= 9; m++) {
      const v = decade * m
      if (v > min && v < max) ticks.push(v)
    }
    decade *= 10
  }
  return ticks
}

const X_MINOR_TICKS = logMinorTicks(X_AXIS_MIN_A, X_AXIS_MAX_A)
const Y_MINOR_TICKS = logMinorTicks(Y_AXIS_MIN_MS, Y_AXIS_MAX_MS)

/** Time-overcurrent (inverse) clearing time at a current, or null below pickup. */
function tocMs(device: ProtectionSettings, current: number): number | null {
  const inv = inverseTripTimeMs(current, device.phasePickupA, device.curveType, device.timeMultiplier)
  return Number.isFinite(inv) ? Math.min(inv + device.breakerOpenTimeMs, Y_AXIS_MAX_MS) : null
}

/** The device's actual FIRST-operation clearing time at the fault current (TOC or fast element). */
function firstOpMs(device: ProtectionSettings, faultA: number): number | null {
  if (faultA < device.phasePickupA) return null
  const decision = relayDecisionMs(faultA, device, shotConfig(device, 0).curveMode)
  return decision == null ? null : decision + device.breakerOpenTimeMs
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[39px] text-fg-muted">{label}</span>
    </span>
  )
}

export function TccChart() {
  const scenario = useScenarioStore((s) => s.scenario)
  const recloser = scenario.protection
  const relay = scenario.substationRelay
  const fuse = scenario.fuseSize
  const I = scenario.faultCurrentA
  const t = useChartTheme()
  const [expanded, setExpanded] = useState(false)

  const data = useMemo(() => {
    const pts: {
      current: number
      recloser: number | null
      relay: number | null
      fuseMelt: number | null
      fuseClear: number | null
      fuseBand: [number, number] | null
    }[] = []
    // Sweep the FULL x-axis range, not just from the devices' pickup — a fuse's minimum-melt
    // current can sit well below either device's pickup, and it still needs to be plottable.
    for (let i = X_AXIS_MIN_A * 1.02; i <= X_AXIS_MAX_A; i *= 1.04) {
      const melt = fuseMinMeltMs(fuse, i)
      const clear = fuseMaxClearMs(fuse, i)
      pts.push({
        current: i,
        recloser: tocMs(recloser, i),
        relay: tocMs(relay, i),
        fuseMelt: melt,
        fuseClear: clear,
        fuseBand: melt != null && clear != null ? [melt, clear] : null,
      })
    }
    return pts
  }, [recloser, relay, fuse])

  const recloserOp = useMemo(() => firstOpMs(recloser, I), [recloser, I])
  const relayOp = useMemo(() => firstOpMs(relay, I), [relay, I])

  // Esc restores the chart from the maximized overlay.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [expanded])

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), [])

  const chart = (
    <ResponsiveContainer>
      <ComposedChart data={data} margin={{ top: 90, right: 56, left: 8, bottom: 30 }}>
        {/* Fine sub-decade grid (2x-9x). Recharts only mounts one <CartesianGrid> per chart, so
            the bold decade lines on top are drawn as plain ReferenceLines below instead of a
            second grid layer — same two-tier look as a real log-log TCC sheet. */}
        <CartesianGrid
          stroke={GRID_MINOR}
          verticalCoordinatesGenerator={({ xAxis }) => X_MINOR_TICKS.map((v) => xAxis!.scale(v))}
          horizontalCoordinatesGenerator={({ yAxis }) => Y_MINOR_TICKS.map((v) => yAxis!.scale(v))}
        />
        {X_TICKS.map((v) => (
          <ReferenceLine key={`xg-${v}`} x={v} stroke={GRID_MAJOR} strokeWidth={1.1} ifOverflow="visible" />
        ))}
        {Y_TICKS.map((v) => (
          <ReferenceLine key={`yg-${v}`} y={v} stroke={GRID_MAJOR} strokeWidth={1.1} ifOverflow="visible" />
        ))}
        <XAxis
          dataKey="current"
          type="number"
          scale="log"
          domain={[X_AXIS_MIN_A, X_AXIS_MAX_A]}
          allowDataOverflow
          ticks={X_TICKS}
          tick={t.axisTick}
          tickFormatter={fmtAmps}
          axisLine={{ stroke: t.axisLine }}
          tickLine={false}
        />
        <YAxis
          type="number"
          scale="log"
          domain={[Y_AXIS_MIN_MS, Y_AXIS_MAX_MS]}
          allowDataOverflow
          ticks={Y_TICKS}
          tick={t.axisTick}
          width={130}
          axisLine={false}
          tickLine={false}
          tickFormatter={fmtTime}
        />
        <Tooltip
          contentStyle={t.tooltip}
          cursor={{ stroke: '#1e3a8a', strokeDasharray: '3 3' }}
          labelFormatter={(v) => `${Math.round(Number(v))} A`}
          formatter={(v: number, name: string) => [
            fmtTime(v),
            name === 'recloser'
              ? 'Recloser'
              : name === 'relay'
                ? 'Substation relay'
                : name === 'fuseMelt'
                  ? 'Fuse min melt'
                  : 'Fuse max clear',
          ]}
        />
        <ReferenceLine
          x={I}
          stroke={FAULT_LINE_COLOR}
          strokeWidth={2}
          strokeDasharray="4 3"
          label={{ value: 'fault', fontSize: 80, fill: FAULT_LINE_COLOR, position: 'top' }}
        />
        {/* Marks the selected fault current (Fault Simulation card) at 5 cycles on the vertical line. */}
        <ReferenceDot x={I} y={FAULT_DOT_MS} r={5} fill="#000000" stroke="none" isFront ifOverflow="visible" />
        {fuse !== 'NA' && (
          <Area
            dataKey="fuseBand"
            stroke="none"
            fill={FUSE_COLOR}
            fillOpacity={0.18}
            isAnimationActive={false}
            connectNulls
          />
        )}
        {fuse !== 'NA' && (
          <Line
            type="monotone"
            dataKey="fuseMelt"
            stroke={FUSE_COLOR}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        )}
        {fuse !== 'NA' && (
          <Line
            type="monotone"
            dataKey="fuseClear"
            stroke={FUSE_COLOR}
            strokeWidth={1.5}
            strokeDasharray="3 2"
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        )}
        <Line
          type="monotone"
          dataKey="recloser"
          stroke={RECLOSER_COLOR}
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="relay"
          stroke={RELAY_COLOR}
          strokeWidth={2.5}
          strokeDasharray="5 3"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        {recloserOp != null && (
          <ReferenceDot
            x={I}
            y={recloserOp}
            r={4}
            fill={RECLOSER_COLOR}
            stroke={t.surface}
            strokeWidth={2}
            label={{ value: fmtTime(recloserOp), fontSize: 39, fill: RECLOSER_COLOR, position: 'right' }}
          />
        )}
        {relayOp != null && (
          <ReferenceDot
            x={I}
            y={relayOp}
            r={4}
            fill={RELAY_COLOR}
            stroke={t.surface}
            strokeWidth={2}
            label={{ value: fmtTime(relayOp), fontSize: 39, fill: RELAY_COLOR, position: 'left' }}
          />
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )

  const maximizeButton = (
    <button
      type="button"
      onClick={toggleExpanded}
      title={expanded ? 'Restore' : 'Maximize'}
      aria-label={expanded ? 'Restore chart size' : 'Maximize chart'}
      aria-pressed={expanded}
      className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-md border border-edge/60 text-fg-muted transition-colors hover:border-brand hover:text-fg"
    >
      {expanded ? <Minimize2 size={39} /> : <Maximize2 size={39} />}
    </button>
  )

  const card = (
    <Card className={cn('force-light flex flex-col', expanded && 'h-full')}>
      <CardHeader
        eyebrow="Protection"
        title="Time–current curves (TCC)"
        large
        right={
          <div className="flex items-center gap-2">
            {!scenario.protectionEnabled && <Badge tone="deenergized">Disabled</Badge>}
            {maximizeButton}
          </div>
        }
      />
      <div className={expanded ? 'min-h-0 flex-1' : 'aspect-[4/3] w-full'}>{chart}</div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
        <LegendDot color={RECLOSER_COLOR} label="Recloser" />
        <LegendDot color={RELAY_COLOR} label="Substation relay" />
        {fuse !== 'NA' && (
          <LegendDot
            color={FUSE_COLOR}
            label={`Fuse (${FUSE_OPTIONS.find((o) => o.value === fuse)?.label ?? fuse}) min melt – max clear`}
          />
        )}
      </div>
    </Card>
  )

  if (!expanded) return card

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={toggleExpanded}
    >
      <div className="aspect-[4/5] h-[88vh] max-w-[80vw]" onClick={(e) => e.stopPropagation()}>
        {card}
      </div>
    </div>
  )
}
