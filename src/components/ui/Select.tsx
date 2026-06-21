import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface SelectProps {
  label?: string
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
}

export function Select({ label, value, options, onChange, disabled }: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && <span className="label-eyebrow">{label}</span>}
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full appearance-none rounded-lg border border-edge bg-panel-raised px-3 py-2 pr-8 text-sm text-fg outline-none transition-colors hover:border-edge-bright focus:border-brand/50 focus-visible:ring-2 focus-visible:ring-brand/40',
            disabled && 'opacity-50',
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
      </div>
    </div>
  )
}
