import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'danger' | 'subtle' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-energized/15 text-energized border-energized/30 hover:bg-energized/25',
  danger: 'bg-fault/15 text-fault border-fault/30 hover:bg-fault/25',
  subtle: 'bg-panel-raised text-slate-200 border-edge hover:border-edge-bright',
  ghost: 'bg-transparent text-slate-400 border-transparent hover:bg-white/5 hover:text-slate-100',
}

export function Button({
  variant = 'subtle',
  className,
  ...props
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
