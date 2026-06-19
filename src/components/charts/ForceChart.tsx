import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { useScenarioStore } from '@/state/useScenarioStore'
import { COLORS } from '@/utils/labels'
import { AXIS_TICK, GRID_STROKE, TOOLTIP_STYLE, useChartData, useThrottledCursor } from './useChartData'

export function ForceChart() {
  const result = useScenarioStore((s) => s.result)
  const data = useChartData()
  const cursorS = useThrottledCursor() / 1000
  const durS = result.durationMs / 1000

  return (
    <Card className="flex flex-col">
      <CardHeader eyebrow="Physics" title="Magnetic force" />
      <div className="h-[150px] w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="forceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.fault} stopOpacity={0.5} />
                <stop offset="100%" stopColor={COLORS.fault} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis
              dataKey="tS"
              type="number"
              domain={[0, durS]}
              tick={AXIS_TICK}
              tickFormatter={(v) => `${v.toFixed(1)}s`}
              axisLine={{ stroke: '#1d2734' }}
              tickLine={false}
            />
            <YAxis tick={AXIS_TICK} width={34} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v) => `t = ${Number(v).toFixed(2)} s`}
              formatter={(v: number) => [`${v.toFixed(1)} N/m`, 'Force']}
            />
            <Area
              type="monotone"
              dataKey="force"
              stroke={COLORS.fault}
              strokeWidth={1.6}
              fill="url(#forceFill)"
              isAnimationActive={false}
            />
            <ReferenceLine x={cursorS} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">Force per length (N/m) — zero while the breaker is open.</p>
    </Card>
  )
}
