import {
  Area,
  ComposedChart,
  CartesianGrid,
  Label,
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

// Same span color scheme as the conductor-clearance chart.
const SPAN1_COLOR = COLORS.healthy // green
const SPAN2_COLOR = COLORS.energized // blue
const SPAN3_COLOR = COLORS.fault // red

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[39px] text-fg-muted">{label}</span>
    </span>
  )
}

export function ForceChart() {
  const result = useScenarioStore((s) => s.result)
  const data = useChartData()
  const cursorS = useThrottledCursor() / 1000
  const durS = result.durationMs / 1000
  const t = useChartTheme()

  return (
    <Card className="force-light flex flex-col">
      <CardHeader eyebrow="Physics" title="Magnetic force" large />
      <div className="aspect-[4/3] w-full">
        <ResponsiveContainer>
          <ComposedChart data={data} margin={{ top: 10, right: 56, left: 8, bottom: 30 }}>
            <defs>
              <linearGradient id="forceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SPAN3_COLOR} stopOpacity={0.45} />
                <stop offset="100%" stopColor={SPAN3_COLOR} stopOpacity={0} />
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
            <YAxis tick={t.axisTick} width={130} axisLine={false} tickLine={false}>
              <Label
                value="N/m"
                position="insideTopLeft"
                offset={6}
                style={{ fontSize: 39, fill: t.axisTick.fill, letterSpacing: '0.06em' }}
              />
            </YAxis>
            <Tooltip
              contentStyle={t.tooltip}
              cursor={{ stroke: t.axisLine }}
              labelFormatter={(v) => `t = ${Number(v).toFixed(2)} s`}
              formatter={(v: number, name: string) => [
                `${v.toFixed(1)} N/m`,
                name === 'force1' ? 'Span 1' : name === 'force2' ? 'Span 2' : 'Span 3',
              ]}
            />
            <Area
              type="monotone"
              dataKey="force"
              stroke="none"
              fill="url(#forceFill)"
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="force1"
              stroke={SPAN1_COLOR}
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="force2"
              stroke={SPAN2_COLOR}
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="force"
              stroke={SPAN3_COLOR}
              strokeWidth={1.8}
              dot={false}
              isAnimationActive={false}
            />
            <ReferenceLine x={cursorS} stroke={t.playhead} strokeOpacity={0.55} strokeWidth={1} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5">
        <LegendDot color={SPAN1_COLOR} label="Span 1" />
        <LegendDot color={SPAN2_COLOR} label="Span 2" />
        <LegendDot color={SPAN3_COLOR} label="Span 3" />
      </div>
      <p className="mt-2 text-[39px] text-fg-faint">Force per length (N/m) — zero while the breaker is open.</p>
    </Card>
  )
}
