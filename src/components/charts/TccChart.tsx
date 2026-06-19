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
import { AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE } from './useChartData'

const fmtTime = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(ms >= 10000 ? 0 : 1)}s` : `${Math.round(ms)}ms`)

export function TccChart() {
  const scenario = useScenarioStore((s) => s.scenario)
  const p = scenario.protection
  const I = scenario.faultCurrentA

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
      <div className="h-[150px] w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} />
            <XAxis
              dataKey="current"
              type="number"
              scale="log"
              domain={[Math.max(p.phasePickupA, 100), 12000]}
              allowDataOverflow
              tick={AXIS_TICK}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k`}
              axisLine={{ stroke: '#1d2734' }}
              tickLine={false}
            />
            <YAxis
              type="number"
              scale="log"
              domain={[30, 40000]}
              allowDataOverflow
              ticks={[100, 1000, 10000]}
              tick={AXIS_TICK}
              width={40}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmtTime}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
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
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
            {opMs != null && <ReferenceDot x={I} y={opMs} r={4} fill={COLORS.energized} stroke="#0e141d" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        Total clearing time vs fault current. Dot = this fault's operating point.
      </p>
    </Card>
  )
}
