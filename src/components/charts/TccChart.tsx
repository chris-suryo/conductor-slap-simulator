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
import { inverseTripTimeMs } from '@/simulation/protection'
import { RELAY_PROCESSING_MS } from '@/simulation/constants'
import { COLORS } from '@/utils/labels'
import { useChartTheme } from './useChartData'

/*
 * FUTURE UPGRADE (flagged): this is the prime candidate for swapping Recharts → visx/D3 or
 * uPlot. A publication-grade TCC needs true log-log MINOR gridlines (1-2-3-5 per decade),
 * multiple stacked device curves (phase + ground + downstream coordination), and shaded
 * coordination margins — all of which Recharts fights us on. The time-series charts are fine
 * on Recharts; only this one would materially benefit. Keep it behind this component boundary
 * so a future swap stays local.
 */

const fmtTime = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : `${Math.round(ms)}ms`)
const fmtAmps = (a: number) => (a >= 1000 ? `${+(a / 1000).toFixed(1)}k` : `${Math.round(a)}`)

const X_TICKS = [1000, 2000, 3000, 5000, 7000, 10000]
const Y_TICKS = [100, 1000, 10000]

export function TccChart() {
  const scenario = useScenarioStore((s) => s.scenario)
  const p = scenario.protection
  const I = scenario.faultCurrentA
  const t = useChartTheme()

  const data = useMemo(() => {
    const pts: { current: number; ms: number }[] = []
    const start = Math.max(p.phasePickupA * 1.3, 100)
    for (let i = start; i <= 12000; i *= 1.05) {
      let ms: number
      if (i >= p.phaseInstantaneousPickupA) ms = RELAY_PROCESSING_MS + p.breakerOpenTimeMs
      else {
        const inv = inverseTripTimeMs(i, p.phasePickupA, p.curveType, p.timeMultiplier)
        if (!Number.isFinite(inv)) continue
        ms = inv + p.breakerOpenTimeMs
      }
      pts.push({ current: i, ms: Math.min(ms, 40000) })
    }
    return pts
  }, [p.phasePickupA, p.phaseInstantaneousPickupA, p.curveType, p.timeMultiplier, p.breakerOpenTimeMs])

  const opMs = useMemo(() => {
    if (I < p.phasePickupA) return null
    if (I >= p.phaseInstantaneousPickupA) return RELAY_PROCESSING_MS + p.breakerOpenTimeMs
    const inv = inverseTripTimeMs(I, p.phasePickupA, p.curveType, p.timeMultiplier)
    return Number.isFinite(inv) ? inv + p.breakerOpenTimeMs : null
  }, [I, p])

  return (
    <Card className="flex flex-col">
      <CardHeader
        eyebrow="Protection"
        title="Time–current curve (TCC)"
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
              domain={[Math.max(p.phasePickupA, 100), 12000]}
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
              domain={[30, 40000]}
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
              formatter={(v: number) => [fmtTime(v), 'Clear']}
            />
            <ReferenceLine
              x={I}
              stroke={COLORS.energized}
              strokeDasharray="4 3"
              label={{ value: 'fault', fontSize: 9, fill: COLORS.energized, position: 'top' }}
            />
            <Line
              type="monotone"
              dataKey="ms"
              stroke={COLORS.caution}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            {opMs != null && (
              <ReferenceDot
                x={I}
                y={opMs}
                r={4}
                fill={COLORS.energized}
                stroke={t.surface}
                strokeWidth={2}
                label={{
                  value: `trip ${fmtTime(opMs)}`,
                  fontSize: 9,
                  fill: COLORS.energized,
                  position: 'right',
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-fg-faint">
        Total clearing time vs fault current. Dot = this fault's operating point.
      </p>
    </Card>
  )
}
