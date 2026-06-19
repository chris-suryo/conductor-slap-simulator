import { cn } from '@/utils/cn'

export function Disclaimer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 text-[11px] leading-snug text-slate-500',
        className,
      )}
    >
      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM9 9a1 1 0 012 0v4a1 1 0 11-2 0V9zm1-4a1 1 0 100 2 1 1 0 000-2z"
          clipRule="evenodd"
        />
      </svg>
      <span>
        Educational visualization of conductor-slap behavior and recloser sequencing.
        Uses simplified physics with tuned constants — <span className="text-slate-400">not</span> a
        certified design or relay-setting tool.
      </span>
    </div>
  )
}
