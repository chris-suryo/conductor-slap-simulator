import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('panel p-4', className)}>{children}</div>
}

export function CardHeader({
  eyebrow,
  title,
  right,
}: {
  eyebrow?: string
  title?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        {eyebrow && <div className="label-eyebrow mb-1">{eyebrow}</div>}
        {title && <h3 className="text-sm font-semibold leading-tight text-fg">{title}</h3>}
      </div>
      {right}
    </div>
  )
}
