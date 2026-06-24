import {
  Area,
  ComposedChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardHeader } from '@/components/ui/Card'
import { useScenarioStore } from '@/state/useScenarioStore'
import { COLORS } from '@/utils/labels'
import { useChartData, useChartTheme, useThrottledCursor } from './useChartData'

export function DisplacementChart() {
  const result = useScenarioStore((s) => s.result)
  const data = useChartData()
  const cursorS = useThrottledCursor() / 1000
  const durS = result.durationMs / 1000
  const t = useChartTheme()
  const threshold = result.contactThresholdFt

  return (
    <Card className="force-light flex flex-col">
      <CardHeader eyebrow="Physics" title="Conductor clearance" />
      <div className="aspect-[6/5] w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="clearanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.energized} stopOpacity={0.22} />
                <stop offset="100%" stopColor={COLORS.energized} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={t.gridStroke} vertical={false} />
            <XAxis
              dataKey="tS"
              type="number"
              domain={[0, durS]}
              tick={t.axisTick}
              tickFormatter={(v) => `${v.toFixed(1)}s`}
              axisLine={{ stroke: t.axisLine }}
              tickLine={false}
            />
            <YAxis tick={t.axisTick} width={34} axisLine={false} tickLine={false} unit="ft" />
            <Tooltip
              contentStyle={t.tooltip}
              cursor={{ stroke: t.axisLine }}
              labelFormatter={(v) => `t = ${Number(v).toFixed(2)} s`}
              formatter={(v: number) => [`${v.toFixed(2)} ft`, 'Clearance']}
            />
            {/* Danger band: clearance at/under the slap threshold. */}
            <ReferenceLine
              y={threshold}
              stroke={COLORS.fault}
              strokeDasharray="4 3"
              label={{ value: 'slap', fontSize: 9, fill: COLORS.fault, position: 'insideBottomRight' }}
            />
            <Area
              type="monotone"
              dataKey="clearance"
              stroke="none"
              fill="url(#clearanceFill)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="clearance"
              stroke={COLORS.energized}
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceLine x={cursorS} stroke={t.playhead} strokeOpacity={0.55} strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-fg-faint">
        Surface-to-surface gap (ft). Touching the dashed line is a slap.
      </p>
    </Card>
  )
}
