import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/state/useThemeStore'
import { cn } from '@/utils/cn'

/** Header button that flips between dark and light themes (persisted). */
export function ThemeToggle({ className }: { className?: string }) {
  const resolved = useThemeStore((s) => s.resolved)
  const toggle = useThemeStore((s) => s.toggle)
  const isDark = resolved === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label="Toggle color theme"
      className={cn(
        'flex h-24 w-24 items-center justify-center rounded-lg border border-edge bg-panel-raised text-fg-muted transition-colors hover:border-edge-bright hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50',
        className,
      )}
    >
      {isDark ? <Sun className="h-12 w-12" /> : <Moon className="h-12 w-12" />}
    </button>
  )
}
