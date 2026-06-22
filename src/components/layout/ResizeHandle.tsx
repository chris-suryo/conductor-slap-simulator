import { useRef } from 'react'
import { cn } from '@/utils/cn'

/**
 * A thin vertical drag divider for resizing the side panels. Uses pointer capture
 * and reports the per-move delta (px) to `onDrag`; the caller (layout store) clamps.
 * Locks the body cursor / disables text selection while dragging.
 */
export function ResizeHandle({
  onDrag,
  ariaLabel,
  className,
}: {
  onDrag: (deltaPx: number) => void
  ariaLabel: string
  className?: string
}) {
  const lastX = useRef(0)
  const dragging = useRef(false)

  const setBodyDragging = (on: boolean) => {
    document.body.classList.toggle('select-none', on)
    document.body.style.cursor = on ? 'col-resize' : ''
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      tabIndex={0}
      className={cn(
        'group relative flex w-1.5 shrink-0 cursor-col-resize touch-none items-stretch justify-center',
        'focus:outline-none',
        className,
      )}
      onPointerDown={(e) => {
        lastX.current = e.clientX
        dragging.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        setBodyDragging(true)
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return
        const delta = e.clientX - lastX.current
        lastX.current = e.clientX
        if (delta !== 0) onDrag(delta)
      }}
      onPointerUp={(e) => {
        dragging.current = false
        e.currentTarget.releasePointerCapture(e.pointerId)
        setBodyDragging(false)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') onDrag(-16)
        else if (e.key === 'ArrowRight') onDrag(16)
      }}
    >
      <span
        className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 rounded-full bg-edge transition-colors group-hover:bg-brand group-focus:bg-brand"
      />
    </div>
  )
}
