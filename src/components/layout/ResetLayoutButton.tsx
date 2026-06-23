import { Columns3 } from 'lucide-react'
import { useLayoutStore } from '@/state/useLayoutStore'
import { cn } from '@/utils/cn'

/** Header button that restores the left/right panel widths to their defaults. */
export function ResetLayoutButton({ className }: { className?: string }) {
  const resetWidths = useLayoutStore((s) => s.resetWidths)
  return (
    <button
      type="button"
      onClick={resetWidths}
      title="Reset panel widths"
      aria-label="Reset panel widths"
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-lg border border-edge bg-panel-raised text-fg-muted transition-colors hover:border-edge-bright hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
        className,
      )}
    >
      <Columns3 className="h-4 w-4" />
    </button>
  )
}
