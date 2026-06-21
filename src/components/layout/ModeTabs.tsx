import { useScenarioStore, type ViewMode } from '@/state/useScenarioStore'
import { cn } from '@/utils/cn'

const TABS: { id: ViewMode; label: string }[] = [
  { id: 'physics', label: 'Physics' },
  { id: 'protection', label: 'Protection' },
  { id: 'presentation', label: 'Presentation' },
]

export function ModeTabs() {
  const mode = useScenarioStore((s) => s.mode)
  const setMode = useScenarioStore((s) => s.setMode)
  return (
    <div className="inline-flex rounded-lg border border-edge bg-panel-muted p-0.5">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => setMode(t.id)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            mode === t.id
              ? 'bg-brand/15 text-brand shadow-sm'
              : 'text-fg-muted hover:text-fg',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
