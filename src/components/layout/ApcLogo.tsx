import { cn } from '@/utils/cn'
import { BRAND } from '@/theme/brand'
import { useThemeStore } from '@/state/useThemeStore'

/**
 * APC Relay Engineering logo.
 *
 * Renders the official logo image when one is supplied in src/theme/brand.ts (`BRAND.logo.src`,
 * with an optional light-background variant); otherwise falls back to a typographic wordmark
 * built from the BRAND tokens. Swapping in the official asset is a one-line change in brand.ts.
 */
export function ApcLogo({
  className,
  size = 'sm',
}: {
  className?: string
  size?: 'sm' | 'lg'
}) {
  const resolved = useThemeStore((s) => s.resolved)
  const lg = size === 'lg'
  const { logo } = BRAND

  if (logo.src) {
    const src = resolved === 'light' && logo.srcLight ? logo.srcLight : logo.src
    const height = lg ? 220 : 140
    return (
      <img
        src={src}
        alt={BRAND.name}
        className={cn('block w-auto select-none', className)}
        style={{ height, aspectRatio: String(logo.aspect) }}
      />
    )
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-md bg-brand font-extrabold leading-none tracking-tight text-on-accent',
          lg ? 'px-3 py-2 text-2xl' : 'px-2 py-1 text-sm',
        )}
      >
        {BRAND.wordmark}
      </span>
      <span className="flex flex-col leading-none">
        <span className={cn('font-semibold tracking-[0.16em] text-fg', lg ? 'text-sm' : 'text-[10px]')}>
          {BRAND.sub[0]}
        </span>
        <span
          className={cn('font-medium tracking-[0.22em] text-fg-faint', lg ? 'text-[10px]' : 'text-[8px]')}
        >
          {BRAND.sub[1]}
        </span>
      </span>
    </div>
  )
}
