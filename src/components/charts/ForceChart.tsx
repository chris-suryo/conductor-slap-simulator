import {
  Area,
  AreaChart,
  CartesianGrid,
  Label,
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

export function ForceChart() {
  const result = useScenarioStore((s) => s.result)
  const data = useChartData()
  const cursorS = useThrottledCursor() / 1000
  const durS = result.durationMs / 1000
  const t = useChartTheme()

  return (
    <Card className="force-light flex flex-col">
      <CardHeader eyebrow="Physics" title="Magnetic force" />
      <div className="h-[clamp(24px,3.2vh,36px)] w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="forceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.fault} stopOpacity={0.45} />
                <stop offset="100%" stopColor={COLORS.fault} stopOpacity={0} />
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
            <YAxis tick={t.axisTick} width={38} axisLine={false} tickLine={false}>
              <Label
                value="N/m"
                position="insideTopLeft"
                offset={6}
                style={{ fontSize: 9, fill: t.axisTick.fill, letterSpacing: '0.06em' }}
              />
            </YAxis>
            <Tooltip
              contentStyle={t.tooltip}
              cursor={{ stroke: t.axisLine }}
              labelFormatter={(v) => `t = ${Number(v).toFixed(2)} s`}
              formatter={(v: number) => [`${v.toFixed(1)} N/m`, 'Force']}
            />
            <Area
              type="monotone"
              dataKey="force"
              stroke={COLORS.fault}
              strokeWidth={1.8}
              fill="url(#forceFill)"
              isAnimationActive={false}
            />
            <ReferenceLine x={cursorS} stroke={t.playhead} strokeOpacity={0.55} strokeWidth={1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[10px] text-fg-faint">Force per length (N/m) — zero while the breaker is open.</p>
    </Card>
  )
}
