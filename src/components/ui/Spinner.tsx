import { cn } from '@/utils/cn'

/** Branded loading spinner (used as the 3D scene's Suspense fallback). */
export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3', className)}>
      <span className="h-7 w-7 animate-spin rounded-full border-2 border-edge border-t-brand" />
      {label && <span className="label-eyebrow">{label}</span>}
    </div>
  )
}
