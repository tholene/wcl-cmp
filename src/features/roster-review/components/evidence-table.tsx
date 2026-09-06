import { useState, type FC } from 'react'
import { PercentileBar } from '@/features/player-analysis/components/percentile-bar'
import { SpecIcon } from '@/features/player-analysis/components/spec-icon'
import { getWowClassColor } from '@/lib/wow-class'
import { cn } from '@/lib/utils'
import { EVIDENCE_TAG_EXPLANATIONS, EVIDENCE_TAG_LABELS, sortRosterRows, type RosterReviewRow, type RosterSortKey } from '../lib/evidence-grouping'
import { formatAmount, formatIlvl, formatPercentile } from '../lib/roster-format'
import { RAID_ROLE_LABELS } from '../lib/spec-raid-role'
import type { RosterDecision } from '../types/roster-review.types'
import { BRACKET_PARSE_TOOLTIP, OVERALL_PARSE_TOOLTIP } from './parse-help'
import { RosterChip } from './roster-ui'

type Column = { key: RosterSortKey; label: string; title?: string; group?: 'overall' | 'bracket' }

const COLUMNS: Column[] = [
  { key: 'name', label: 'Player' },
  { key: 'role', label: 'Role' },
  { key: 'availability', label: 'Avail.' },
  { key: 'overallMedian', label: 'Median', title: OVERALL_PARSE_TOOLTIP, group: 'overall' },
  { key: 'overallLatest', label: 'Latest', title: OVERALL_PARSE_TOOLTIP, group: 'overall' },
  { key: 'overallBest', label: 'Best', title: OVERALL_PARSE_TOOLTIP, group: 'overall' },
  { key: 'bracketMedian', label: 'Bracket', title: BRACKET_PARSE_TOOLTIP, group: 'bracket' },
  { key: 'itemLevel', label: 'Ilvl' },
  { key: 'output', label: 'Output', title: 'Mean raw DPS/HPS across ranked kills (context only).' },
  { key: 'logPresence', label: 'Logs', title: 'Presence in the selected reports. Not an attendance verdict.' },
  { key: 'deaths', label: 'Deaths', title: 'Deaths on checked kill fights: deaths in fights-with-death / fights checked.' },
  { key: 'sampleSize', label: 'Kills', title: 'Ranked kill fights used for the numbers (sample size).' },
]

const DECISION_LABEL: Record<RosterDecision, string> = { start: 'Start', flex: 'Flex', notSelected: 'Not selected' }

type EvidenceTableProps = {
  rows: RosterReviewRow[]
  selectedForCompare: string[]
  onToggleCompare: (playerName: string) => void
  onOpenDetails: (playerName: string) => void
}

export const EvidenceTable: FC<EvidenceTableProps> = ({ rows, selectedForCompare, onToggleCompare, onOpenDetails }) => {
  const [sortKey, setSortKey] = useState<RosterSortKey>('role')
  const [direction, setDirection] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (key: RosterSortKey) => {
    if (key === sortKey) {
      setDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setDirection(key === 'name' || key === 'role' || key === 'availability' ? 'asc' : 'desc')
  }

  const sorted = sortRosterRows(rows, sortKey, direction)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-separate border-spacing-y-1 text-xs">
        <thead>
          <tr className="text-[9px] uppercase tracking-[0.08em] text-hint">
            <th colSpan={3} />
            <th colSpan={3} className="px-2 pb-0 text-center font-semibold text-indigo-200" title={OVERALL_PARSE_TOOLTIP}>Overall parse · primary</th>
            <th className="px-2 pb-0 text-center font-semibold text-sky-200" title={BRACKET_PARSE_TOOLTIP}>Ilvl parse · secondary</th>
            <th colSpan={6} />
          </tr>
          <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-hint">
            {COLUMNS.map((column) => (
              <th key={column.key} className="px-2 py-1 font-semibold">
                <button
                  type="button"
                  title={column.title}
                  onClick={() => toggleSort(column.key)}
                  className={cn('inline-flex items-center gap-1 hover:text-slate-200', sortKey === column.key && 'text-slate-100')}
                >
                  {column.label}
                  {sortKey === column.key && <span aria-hidden>{direction === 'asc' ? '↑' : '↓'}</span>}
                </button>
              </th>
            ))}
            <th className="px-2 py-1 font-semibold">Signals</th>
            <th className="px-2 py-1 font-semibold">Compare</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const e = row.evidence
            const p = e?.performance
            const className = e?.className ?? row.entry.className
            const compareActive = selectedForCompare.includes(row.entry.playerName)
            return (
              <tr key={row.entry.id} className={cn('bg-[rgba(26,27,30,0.6)]', row.entry.availability === 'absent' && 'opacity-60')}>
                <td className="rounded-l-lg px-2 py-1.5">
                  <button type="button" onClick={() => onOpenDetails(row.entry.playerName)} className="flex items-center gap-2 text-left hover:underline">
                    <SpecIcon className={className ?? undefined} specName={e?.primarySpecName ?? undefined} size={22} />
                    <span>
                      <span className="block font-semibold" style={{ color: getWowClassColor(className) }}>{row.entry.playerName}</span>
                      <span className="block text-[10px] text-hint">
                        {e?.primarySpecName ?? '?'} {className ?? ''}{e && e.specsSeen.length > 1 ? ` (+${e.specsSeen.length - 1})` : ''}
                        {row.decision && <span className="ml-1 text-indigo-300">· {DECISION_LABEL[row.decision.decision]}</span>}
                      </span>
                    </span>
                  </button>
                </td>
                <td className="px-2 py-1.5 text-slate-300">{RAID_ROLE_LABELS[row.entry.role]}</td>
                <td className="px-2 py-1.5">
                  <span className={cn(row.entry.availability === 'available' ? 'text-emerald-300' : row.entry.availability === 'late' ? 'text-amber-300' : 'text-rose-300')}>
                    {row.entry.availability}
                  </span>
                </td>
                <td className="px-2 py-1.5">{p?.overall?.median != null ? <PercentileBar value={Math.round(p.overall.median)} compact /> : <span className="text-hint">—</span>}</td>
                <td className="px-2 py-1.5 tabular-nums text-slate-200">{formatPercentile(p?.overall?.latest)}</td>
                <td className="px-2 py-1.5 tabular-nums text-slate-400">{formatPercentile(p?.overall?.best)}</td>
                <td className="px-2 py-1.5 tabular-nums text-sky-200">{formatPercentile(p?.bracket?.median)}</td>
                <td className="px-2 py-1.5 tabular-nums text-slate-200">{formatIlvl(p?.itemLevel?.latest)}</td>
                <td className="px-2 py-1.5 tabular-nums text-slate-300">{p?.output ? `${formatAmount(p.output.meanAmount)} ${p.output.metric}` : '—'}</td>
                <td className="px-2 py-1.5 tabular-nums text-slate-300">
                  {e ? `${e.logPresence.reportsPresent}/${e.logPresence.reportsTotal}` : '—'}
                  {e && e.fightPresence.satOutKillFights > 0 && <span className="ml-1 text-[10px] text-hint">sat {e.fightPresence.satOutKillFights}</span>}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-slate-300">
                  {e ? (e.execution.killFightsChecked > 0 ? `${e.execution.deaths} · ${e.execution.fightsWithDeath}/${e.execution.killFightsChecked}` : 'unknown') : '—'}
                </td>
                <td className="px-2 py-1.5 tabular-nums text-slate-300">{p?.sampleSize ?? 0}</td>
                <td className="px-2 py-1.5">
                  <span className="flex max-w-[220px] flex-wrap gap-1">
                    {row.tags.map((tag) => (
                      <RosterChip key={tag} tone={tag === 'strongEvidence' ? 'success' : tag === 'boundary' ? 'accent' : tag === 'limitedEvidence' ? 'caution' : 'neutral'} title={EVIDENCE_TAG_EXPLANATIONS[tag]}>
                        {EVIDENCE_TAG_LABELS[tag]}
                      </RosterChip>
                    ))}
                    {e?.signals.map((signal) => (
                      <RosterChip key={signal.code} tone={signal.severity === 'caution' ? 'caution' : 'info'} title={signal.detail}>{signal.label}</RosterChip>
                    ))}
                  </span>
                </td>
                <td className="rounded-r-lg px-2 py-1.5">
                  <RosterChip tone={compareActive ? 'accent' : 'neutral'} active={compareActive} onClick={() => onToggleCompare(row.entry.playerName)}>
                    {compareActive ? 'selected' : 'compare'}
                  </RosterChip>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
