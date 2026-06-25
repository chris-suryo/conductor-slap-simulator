import type { ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function Card({
  className,
  accent = true,
  children,
}: {
  className?: string
  /** Show the thin APC brand rule along the card's top edge. */
  accent?: boolean
  children: ReactNode
}) {
  return <div className={cn('panel p-3', accent && 'panel-accent', className)}>{children}</div>
}

export function CardHeader({
  eyebrow,
  title,
  right,
  large = false,
}: {
  eyebrow?: string
  title?: ReactNode
  right?: ReactNode
  /** Bigger eyebrow/title text — for cards that live outside the zoomed side panels
   * (chart cards, timeline) and would otherwise read small next to them. */
  large?: boolean
}) {
  return (
    <div className="mb-2 flex items-start justify-between gap-3">
      <div>
        {eyebrow && (
          <div
            className={cn(
              'label-eyebrow label-eyebrow-accent mb-1',
              large && 'text-[39px] tracking-[0.1em]',
            )}
          >
            {eyebrow}
          </div>
        )}
        {title && (
          <h3 className={cn('font-semibold leading-tight text-fg', large ? 'text-[48px]' : 'text-sm')}>
            {title}
          </h3>
        )}
      </div>
      {right}
    </div>
  )
}
