import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'danger' | 'subtle' | 'ghost'

const variants: Record<Variant, string> = {
  primary: 'bg-brand/15 text-brand border-brand/30 hover:bg-brand/25',
  danger: 'bg-fault/15 text-fault border-fault/30 hover:bg-fault/25',
  subtle: 'bg-panel-raised text-fg border-edge hover:border-edge-bright',
  ghost: 'bg-transparent text-fg-muted border-transparent hover:bg-fg/5 hover:text-fg',
}

export function Button({
  variant = 'subtle',
  className,
  ...props
}: { variant?: Variant } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
