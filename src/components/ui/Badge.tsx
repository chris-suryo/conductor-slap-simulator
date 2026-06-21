import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export type BadgeTone = 'energized' | 'healthy' | 'caution' | 'fault' | 'deenergized' | 'neutral'

const tones: Record<BadgeTone, string> = {
  energized: 'bg-energized/12 text-energized border-energized/25',
  healthy: 'bg-healthy/12 text-healthy border-healthy/25',
  caution: 'bg-caution/12 text-caution border-caution/25',
  fault: 'bg-fault/12 text-fault border-fault/25',
  deenergized: 'bg-deenergized/15 text-fg-muted border-deenergized/30',
  neutral: 'bg-fg/5 text-fg-muted border-edge',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
