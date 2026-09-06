import type { FC } from 'react'
import type { RosterCountSummary } from '../lib/roster-counts'
import type { RosterRoleTargets } from '../types/roster-review.types'
import { RosterField, RosterInput } from './roster-ui'

type RoleCountPanelProps = {
  summary: RosterCountSummary
  onTargetsChange: (patch: Partial<Pick<RosterRoleTargets, 'total' | 'tanks' | 'healers'>>) => void
}

const Stat: FC<{ label: string; value: number; target: number | null }> = ({ label, value, target }) => {
  const tone = target === null ? 'text-slate-200' : value === target ? 'text-emerald-300' : value > target ? 'text-rose-300' : 'text-amber-300'
  return (
    <div className="flex flex-col rounded-lg border border-white/[0.06] bg-[rgba(26,27,30,0.6)] px-3 py-2">
      <span className="text-[10px] uppercase tracking-[0.08em] text-hint">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${tone}`}>
        {value}{target !== null && <span className="text-xs font-normal text-hint"> / {target}</span>}
      </span>
    </div>
  )
}

export const RoleCountPanel: FC<RoleCountPanelProps> = ({ summary, onTargetsChange }) => {
  const { targets } = summary
  const number = (value: string): number => {
    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Starting" value={summary.startTotal} target={targets.total} />
        <Stat label="Tanks" value={summary.tanksStarting} target={targets.tanks} />
        <Stat label="Healers" value={summary.healersStarting} target={targets.healers} />
        <Stat label="DPS" value={summary.dpsStarting} target={targets.dps} />
        <Stat label="Flex / bench" value={summary.flexTotal} target={null} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <RosterField label="Roster size">
          <RosterInput type="number" min={0} value={targets.total} onChange={(event) => onTargetsChange({ total: number(event.target.value) })} />
        </RosterField>
        <RosterField label="Tank target">
          <RosterInput type="number" min={0} value={targets.tanks} onChange={(event) => onTargetsChange({ tanks: number(event.target.value) })} />
        </RosterField>
        <RosterField label="Healer target" hint={`DPS target = ${targets.dps}`}>
          <RosterInput type="number" min={0} value={targets.healers} onChange={(event) => onTargetsChange({ healers: number(event.target.value) })} />
        </RosterField>
      </div>
      {summary.notes.length > 0 && (
        <ul className="space-y-0.5 text-[11px] text-amber-200/90">
          {summary.notes.map((note) => <li key={note}>· {note}</li>)}
        </ul>
      )}
    </div>
  )
}
