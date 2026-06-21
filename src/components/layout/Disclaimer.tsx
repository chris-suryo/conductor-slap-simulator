import { Info } from 'lucide-react'
import { cn } from '@/utils/cn'

export function Disclaimer({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-start gap-2 text-[11px] leading-snug text-fg-faint', className)}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-faint" />
      <span>
        Educational visualization of conductor-slap behavior and recloser sequencing. Uses
        simplified physics with tuned constants — <span className="text-fg-muted">not</span> a
        certified design or relay-setting tool.
      </span>
    </div>
  )
}
