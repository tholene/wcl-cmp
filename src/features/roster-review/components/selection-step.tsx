import type { FC } from 'react'
import { SpecIcon } from '@/features/player-analysis/components/spec-icon'
import { PercentileBar } from '@/features/player-analysis/components/percentile-bar'
import { getWowClassColor } from '@/lib/wow-class'
import { cn } from '@/lib/utils'
import { EVIDENCE_TAG_EXPLANATIONS, EVIDENCE_TAG_LABELS, type RosterReviewRow } from '../lib/evidence-grouping'
import type { RosterCountSummary } from '../lib/roster-counts'
import { formatIlvl, formatPercentile } from '../lib/roster-format'
import { RAID_ROLE_LABELS, RAID_ROLE_ORDER } from '../lib/spec-raid-role'
import type { RosterDecision, RosterRaidRole, RosterRoleTargets } from '../types/roster-review.types'
import { RoleCountPanel } from './role-count-panel'
import { RosterButton, RosterChip, RosterHelp, RosterSectionTitle } from './roster-ui'

type SelectionStepProps = {
  rows: RosterReviewRow[]
  summary: RosterCountSummary
  onTargetsChange: (patch: Partial<Pick<RosterRoleTargets, 'total' | 'tanks' | 'healers'>>) => void
  onDecision: (playerName: string, decision: RosterDecision | null) => void
  onBack: () => void
  onContinue: () => void
}

const DECISIONS: Array<{ value: RosterDecision; label: string; tone: 'success' | 'accent' | 'neutral' }> = [
  { value: 'start', label: 'Start', tone: 'success' },
  { value: 'flex', label: 'Flex', tone: 'accent' },
  { value: 'notSelected', label: 'Not selected', tone: 'neutral' },
]

export const SelectionStep: FC<SelectionStepProps> = ({ rows, summary, onTargetsChange, onDecision, onBack, onContinue }) => {
  const byRole = (role: RosterRaidRole) =>
    rows
      .filter((row) => row.entry.role === role)
      .sort((a, b) => (b.evidence?.performance.overall?.median ?? -1) - (a.evidence?.performance.overall?.median ?? -1))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Mark each player Start, Flex (bench with a role) or Not selected. Players are grouped by raid role and ordered by median
        overall parse for reading convenience only; the tags are transparent pointers, not a score. Adjust the role targets to
        match the plan for this raid.
      </p>

      <RoleCountPanel summary={summary} onTargetsChange={onTargetsChange} />

      <RosterHelp title="What the tags mean">
        {(Object.keys(EVIDENCE_TAG_LABELS) as Array<keyof typeof EVIDENCE_TAG_LABELS>).map((tag) => (
          <p key={tag}><span className="font-semibold text-slate-100">{EVIDENCE_TAG_LABELS[tag]}:</span> {EVIDENCE_TAG_EXPLANATIONS[tag]}</p>
        ))}
      </RosterHelp>

      {RAID_ROLE_ORDER.map((role) => {
        const group = byRole(role)
        if (group.length === 0) return null
        const target = group[0].roleTarget
        return (
          <div key={role} className="flex flex-col gap-1.5">
            <RosterSectionTitle right={target !== null ? <span className="text-[11px] text-hint">target {target}{role === 'melee' || role === 'ranged' ? ' DPS total' : ''}</span> : undefined}>
              {RAID_ROLE_LABELS[role]} ({group.length})
            </RosterSectionTitle>
            {group.map((row) => {
              const e = row.evidence
              const p = e?.performance
              const current = row.decision?.decision ?? null
              return (
                <div
                  key={row.entry.id}
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2',
                    current === 'start' ? 'border-emerald-400/30 bg-emerald-500/[0.06]' : current === 'flex' ? 'border-indigo-400/30 bg-indigo-500/[0.06]' : 'border-white/[0.06] bg-[rgba(26,27,30,0.6)]',
                    row.entry.availability === 'absent' && 'opacity-60'
                  )}
                >
                  <SpecIcon className={(e?.className ?? row.entry.className) ?? undefined} specName={e?.primarySpecName ?? undefined} size={26} />
                  <div className="min-w-[140px]">
                    <div className="text-[13px] font-semibold" style={{ color: getWowClassColor(e?.className ?? row.entry.className) }}>{row.entry.playerName}</div>
                    <div className="text-[10px] text-hint">
                      {e?.primarySpecName ?? '?'} · {row.entry.availability}{row.entry.note ? ` · ${row.entry.note}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-300">
                    <span title="Overall parse median (primary)">{p?.overall?.median != null ? <PercentileBar value={Math.round(p.overall.median)} compact /> : <span className="text-hint">no parse</span>}</span>
                    <span className="text-sky-200" title="Ilvl-bracket median (secondary)">br {formatPercentile(p?.bracket?.median)}</span>
                    <span title="Latest item level">ilvl {formatIlvl(p?.itemLevel?.latest)}</span>
                    <span title="Logs present / selected">logs {e ? `${e.logPresence.reportsPresent}/${e.logPresence.reportsTotal}` : '—'}</span>
                    <span title="Ranked kills (sample)">{p?.sampleSize ?? 0} kills</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {row.tags.map((tag) => (
                      <RosterChip key={tag} tone={tag === 'strongEvidence' ? 'success' : tag === 'boundary' ? 'accent' : tag === 'limitedEvidence' ? 'caution' : 'neutral'} title={EVIDENCE_TAG_EXPLANATIONS[tag]}>
                        {EVIDENCE_TAG_LABELS[tag]}
                      </RosterChip>
                    ))}
                  </div>
                  <div className="ml-auto flex gap-1">
                    {DECISIONS.map((option) => (
                      <RosterChip
                        key={option.value}
                        tone={current === option.value ? option.tone : 'neutral'}
                        active={current === option.value}
                        onClick={() => onDecision(row.entry.playerName, current === option.value ? null : option.value)}
                      >
                        {option.label}
                      </RosterChip>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      <div className="flex justify-between">
        <RosterButton onClick={onBack}>← Evidence</RosterButton>
        <RosterButton tone="primary" onClick={onContinue}>Continue to review →</RosterButton>
      </div>
    </div>
  )
}
