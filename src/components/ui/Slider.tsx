import type { CSSProperties } from 'react'
import { cn } from '@/utils/cn'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  unit?: string
  format?: (value: number) => string
  disabled?: boolean
  /** Fill color of the track (CSS color). */
  fill?: string
  hint?: string
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  unit,
  format,
  disabled,
  fill = 'rgb(var(--brand))',
  hint,
}: SliderProps) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  const style = { '--range-pct': `${pct}%`, '--range-fill': fill } as CSSProperties

  return (
    <div className={cn('space-y-1.5', disabled && 'opacity-50')}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-eyebrow">{label}</span>
        <span className="stat-value text-[13px] text-fg">
          {format ? format(value) : value}
          {unit ? <span className="ml-0.5 text-fg-faint">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        className="csim-range"
        style={style}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      {hint && <p className="text-[11px] leading-snug text-fg-faint">{hint}</p>}
    </div>
  )
}
