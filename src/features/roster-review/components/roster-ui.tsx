import type { ButtonHTMLAttributes, FC, InputHTMLAttributes, PropsWithChildren, ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

// Local form primitives: the shared components/ui folder only provides StatusPill,
// so these keep roster-review markup consistent without touching other features.

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'primary' | 'ghost' | 'danger' | 'success' }

export const RosterButton: FC<ButtonProps> = ({ tone = 'ghost', className, ...props }) => (
  <button
    type="button"
    {...props}
    className={cn(
      'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      tone === 'primary' && 'border-indigo-400/40 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30',
      tone === 'ghost' && 'border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]',
      tone === 'danger' && 'border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
      tone === 'success' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
      className
    )}
  />
)

export const RosterInput: FC<InputHTMLAttributes<HTMLInputElement>> = ({ className, ...props }) => (
  <input
    {...props}
    className={cn(
      'w-full rounded-lg border border-white/10 bg-[#1a1b1e]/80 px-2.5 py-1.5 text-xs text-slate-100 outline-none placeholder:text-hint focus:border-indigo-400/60',
      className
    )}
  />
)

export const RosterSelect: FC<SelectHTMLAttributes<HTMLSelectElement>> = ({ className, ...props }) => (
  <select
    {...props}
    className={cn(
      'rounded-lg border border-white/10 bg-[#1a1b1e]/80 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-400/60',
      className
    )}
  />
)

export const RosterTextarea: FC<{ value: string; onChange: (value: string) => void; rows?: number; placeholder?: string; readOnly?: boolean; className?: string }> = ({
  value, onChange, rows = 3, placeholder, readOnly, className,
}) => (
  <textarea
    value={value}
    rows={rows}
    placeholder={placeholder}
    readOnly={readOnly}
    onChange={(event) => onChange(event.target.value)}
    className={cn(
      'w-full resize-y rounded-lg border border-white/10 bg-[#1a1b1e]/80 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-slate-200 outline-none placeholder:text-hint focus:border-indigo-400/60',
      className
    )}
  />
)

export const RosterField: FC<PropsWithChildren<{ label: string; hint?: string; className?: string }>> = ({ label, hint, className, children }) => (
  <label className={cn('flex flex-col gap-1', className)}>
    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-hint">{label}</span>
    {children}
    {hint && <span className="text-[11px] text-hint">{hint}</span>}
  </label>
)

export const RosterChip: FC<PropsWithChildren<{ tone?: 'neutral' | 'info' | 'caution' | 'accent' | 'success'; title?: string; onClick?: () => void; active?: boolean }>> = ({
  tone = 'neutral', title, onClick, active, children,
}) => {
  const classes = cn(
    'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-tight',
    tone === 'neutral' && 'border-white/10 bg-white/[0.04] text-slate-300',
    tone === 'info' && 'border-sky-400/30 bg-sky-400/10 text-sky-200',
    tone === 'caution' && 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    tone === 'accent' && 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200',
    tone === 'success' && 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    onClick && 'cursor-pointer hover:brightness-125',
    active && 'ring-1 ring-indigo-400/60'
  )
  return onClick ? (
    <button type="button" title={title} onClick={onClick} className={classes}>{children}</button>
  ) : (
    <span title={title} className={classes}>{children}</span>
  )
}

export const RosterHelp: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <details className="rounded-lg border border-white/[0.06] bg-[rgba(43,45,49,0.5)] px-3 py-2 text-xs text-slate-300">
    <summary className="cursor-pointer text-[11px] font-semibold text-slate-400">{title}</summary>
    <div className="mt-2 space-y-1.5 leading-relaxed">{children}</div>
  </details>
)

export const RosterSectionTitle: FC<PropsWithChildren<{ right?: ReactNode }>> = ({ children, right }) => (
  <div className="flex items-center justify-between gap-2">
    <h3 className="text-[13px] font-semibold text-slate-100">{children}</h3>
    {right}
  </div>
)
