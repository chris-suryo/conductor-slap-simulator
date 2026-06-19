import {
  CartesianGrid,
  Line,
  LineChart,
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

export function DisplacementChart() {
  const result = useScenarioStore((s) => s.result)
  const data = useChartData()
  const cursorS = useThrottledCursor() / 1000
  const durS = result.durationMs / 1000

  return (
    <Card className="flex flex-col">
      <CardHeader eyebrow="Physics" title="Conductor clearance" />
      <div className="h-[150px] w-full">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
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
            <YAxis tick={AXIS_TICK} width={34} axisLine={false} tickLine={false} unit="ft" />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelFormatter={(v) => `t = ${Number(v).toFixed(2)} s`}
              formatter={(v: number) => [`${v.toFixed(2)} ft`, 'Clearance']}
            />
            <ReferenceLine
              y={result.contactThresholdFt}
              stroke={COLORS.fault}
              strokeDasharray="4 3"
              label={{ value: 'slap', fontSize: 9, fill: COLORS.fault, position: 'insideBottomRight' }}
            />
            <Line
              type="monotone"
              dataKey="clearance"
              stroke={COLORS.energized}
              strokeWidth={1.6}
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceLine x={cursorS} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-slate-500">
        Surface-to-surface gap (ft). Touching the dashed line is a slap.
      </p>
    </Card>
  )
}
