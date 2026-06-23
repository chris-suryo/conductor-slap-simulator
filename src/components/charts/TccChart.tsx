import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { useScenarioStore } from '@/state/useScenarioStore'
import { inverseTripTimeMs, relayDecisionMs } from '@/simulation/protection'
import { shotConfig } from '@/simulation/recloserSequence'
import type { ProtectionSettings } from '@/simulation/types'
import { COLORS } from '@/utils/labels'
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

const X_TICKS = [10, 100, 1000, 2000, 3000, 5000, 7000, 10000]
/** Fixed low end of the x-axis (A) — full standard decades, like a real TCC sheet, regardless of
 * where either device's pickup happens to sit. */
const X_AXIS_MIN_A = 10
/** Y-axis (clearing time) spans 10 ms to 1000 s, like a real TCC sheet. */
const Y_AXIS_MIN_MS = 10
const Y_AXIS_MAX_MS = 1_000_000
const Y_TICKS = [10, 100, 1000, 10000, 100000, 1000000]

// Distinct, theme-constant device colors (orange recloser vs cyan relay).
const RECLOSER_COLOR = COLORS.brand
const RELAY_COLOR = COLORS.energized

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
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[11px] text-fg-muted">{label}</span>
    </span>
  )
}

export function TccChart() {
  const scenario = useScenarioStore((s) => s.scenario)
  const recloser = scenario.protection
  const relay = scenario.substationRelay
  const I = scenario.faultCurrentA
  const t = useChartTheme()

  const data = useMemo(() => {
    const pts: { current: number; recloser: number | null; relay: number | null }[] = []
    const lowPickup = Math.max(Math.min(recloser.phasePickupA, relay.phasePickupA), 100)
    for (let i = lowPickup * 1.02; i <= 12000; i *= 1.04) {
      pts.push({ current: i, recloser: tocMs(recloser, i), relay: tocMs(relay, i) })
    }
    return pts
  }, [recloser, relay])

  const recloserOp = useMemo(() => firstOpMs(recloser, I), [recloser, I])
  const relayOp = useMemo(() => firstOpMs(relay, I), [relay, I])

  return (
    <Card className="flex flex-col">
      <CardHeader
        eyebrow="Protection"
        title="Time–current curves (TCC)"
        right={!scenario.protectionEnabled ? <Badge tone="deenergized">Disabled</Badge> : undefined}
      />
      <div className="h-[clamp(150px,17vh,196px)] w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={t.gridStroke} />
            <XAxis
              dataKey="current"
              type="number"
              scale="log"
              domain={[X_AXIS_MIN_A, 12000]}
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
              width={42}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtTime}
            />
            <Tooltip
              contentStyle={t.tooltip}
              cursor={{ stroke: t.axisLine }}
              labelFormatter={(v) => `${Math.round(Number(v))} A`}
              formatter={(v: number, name: string) => [
                fmtTime(v),
                name === 'recloser' ? 'Recloser' : 'Substation relay',
              ]}
            />
            <ReferenceLine
              x={I}
              stroke={COLORS.fault}
              strokeDasharray="4 3"
              label={{ value: 'fault', fontSize: 9, fill: COLORS.fault, position: 'top' }}
            />
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
              strokeWidth={2}
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
                label={{ value: fmtTime(recloserOp), fontSize: 9, fill: RECLOSER_COLOR, position: 'right' }}
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
                label={{ value: fmtTime(relayOp), fontSize: 9, fill: RELAY_COLOR, position: 'left' }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
        <LegendDot color={RECLOSER_COLOR} label="Recloser" />
        <LegendDot color={RELAY_COLOR} label="Substation relay" />
      </div>
    </Card>
  )
}
