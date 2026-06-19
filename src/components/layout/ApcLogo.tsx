import { cn } from '@/utils/cn'

/**
 * APC Relay Engineering wordmark, recreated typographically from the brand
 * (orange "APC" on navy/black). Used in the header and presentation title card.
 */
export function ApcLogo({
  className,
  size = 'sm',
}: {
  className?: string
  size?: 'sm' | 'lg'
}) {
  const lg = size === 'lg'
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-md bg-brand font-extrabold leading-none tracking-tight text-[#06121e]',
          lg ? 'px-3 py-2 text-2xl' : 'px-2 py-1 text-sm',
        )}
      >
        APC
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-semibold tracking-[0.16em] text-slate-100',
            lg ? 'text-sm' : 'text-[10px]',
          )}
        >
          RELAY
        </span>
        <span
          className={cn(
            'font-medium tracking-[0.22em] text-slate-500',
            lg ? 'text-[10px]' : 'text-[8px]',
          )}
        >
          ENGINEERING
        </span>
      </span>
    </div>
  )
}
