import type { FC } from 'react'
import { cn } from '@/lib/utils'

type StatusPillProps = {
  text: string
  tone: 'neutral' | 'success' | 'danger'
}

export const StatusPill: FC<StatusPillProps> = ({ text, tone }) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide',
      tone === 'neutral' && 'border-slate-600 bg-slate-800 text-slate-300',
      tone === 'success' && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      tone === 'danger' && 'border-rose-500/40 bg-rose-500/10 text-rose-300'
    )}
  >
    {text}
  </span>
)
