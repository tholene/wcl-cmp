import type { FC } from 'react'
import { getWowClassColor } from '@/lib/wow-class'
import { cn } from '@/lib/utils'
import type { CandidateComparison } from '../lib/candidate-comparison'
import type { RosterReviewRow } from '../lib/evidence-grouping'
import { RAID_ROLE_LABELS } from '../lib/spec-raid-role'
import type { RosterComparisonNote, RosterDecision, RosterDecisionEntry, RosterReasonCategory } from '../types/roster-review.types'
import { ComparePanel } from './compare-panel'
import { RosterButton, RosterChip, RosterInput, RosterSectionTitle, RosterSelect } from './roster-ui'

const REASON_OPTIONS: Array<{ value: RosterReasonCategory; label: string }> = [
  { value: 'performance', label: 'Performance' },
  { value: 'consistency', label: 'Consistency' },
  { value: 'attendance', label: 'Attendance / reliability' },
  { value: 'availability', label: 'Availability' },
  { value: 'composition', label: 'Composition / utility' },
  { value: 'evidence', label: 'Insufficient evidence' },
  { value: 'other', label: 'Other' },
]

const REASON_TEMPLATES: Record<RosterDecision, string[]> = {
  start: [
    'Selected: substantially stronger recent overall performance than comparable candidates.',
    'Selected: similar performance to {other}, but stronger recent raid attendance.',
    'Selected: required class/spec/utility for the current composition.',
    'Selected: consistent median performance across the window, not one outlier kill.',
  ],
  flex: [
    'Flex: strong player, but late availability for this raid.',
    'Flex: comparable to starters; first swap for {boss} composition needs.',
    'Flex: limited recent evidence; will rotate in to build a sample.',
  ],
  notSelected: [
    'Bench: similar output to {other}, but lower consistency and poorer recent attendance.',
    'Bench: composition already covers this role; performance gap to the boundary is small.',
    'Bench: insufficient recent evidence to justify a start over comparable candidates.',
    'Bench: absent for this raid.',
  ],
}

const DECISION_LABEL: Record<RosterDecision, string> = { start: 'Start', flex: 'Flex / bench', notSelected: 'Not selected' }

type ReviewStepProps = {
  rows: RosterReviewRow[]
  compareSelection: string[]
  comparison: CandidateComparison | null
  comparisonNotes: RosterComparisonNote[]
  onDecisionPatch: (playerName: string, patch: Partial<RosterDecisionEntry>) => void
  onToggleCompare: (playerName: string) => void
  onClearCompare: () => void
  onSaveComparisonNote: (text: string) => void
  onRemoveComparisonNote: (id: string) => void
  onBack: () => void
  onContinue: () => void
}

export const ReviewStep: FC<ReviewStepProps> = ({
  rows, compareSelection, comparison, comparisonNotes, onDecisionPatch, onToggleCompare, onClearCompare, onSaveComparisonNote, onRemoveComparisonNote, onBack, onContinue,
}) => {
  const groups: Array<{ decision: RosterDecision | null; label: string }> = [
    { decision: 'start', label: 'Start' },
    { decision: 'flex', label: 'Flex / bench' },
    { decision: 'notSelected', label: 'Not selected' },
    { decision: null, label: 'Undecided' },
  ]
  const missingReasons = rows.filter((row) => row.decision && row.decision.reasonText.trim().length === 0).length

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Every Start, Flex and Not-selected decision gets a short structured reason so the same framework is visibly applied to
        everyone. Use “compare” on two players to produce an evidence-backed explanation you can edit and keep.
      </p>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/[0.06] bg-[rgba(26,27,30,0.6)] px-3 py-2 text-[11px] text-slate-300">
        <span className="font-semibold text-slate-100">Compare candidates:</span>
        {compareSelection.length === 0 && <span className="text-hint">pick two players below (or in the evidence table)</span>}
        {compareSelection.map((name) => <RosterChip key={name} tone="accent" onClick={() => onToggleCompare(name)}>{name} ×</RosterChip>)}
        {compareSelection.length > 0 && <RosterButton onClick={onClearCompare}>Clear</RosterButton>}
        {missingReasons > 0 && <span className="ml-auto text-amber-300">{missingReasons} decision(s) still without a reason</span>}
      </div>

      {comparison && (
        <ComparePanel key={`${comparison.a.name}|${comparison.b.name}`} comparison={comparison} onSaveNote={onSaveComparisonNote} onClose={onClearCompare} />
      )}

      {groups.map((group) => {
        const members = rows.filter((row) => (row.decision?.decision ?? null) === group.decision)
        if (members.length === 0) return null
        return (
          <div key={group.label} className="flex flex-col gap-1.5">
            <RosterSectionTitle>{group.label} ({members.length})</RosterSectionTitle>
            {members.map((row) => {
              const decision = row.decision
              const templates = decision ? REASON_TEMPLATES[decision.decision] : []
              const selected = compareSelection.includes(row.entry.playerName)
              return (
                <div key={row.entry.id} className={cn('flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-[rgba(26,27,30,0.6)] px-3 py-2', selected && 'border-indigo-400/40')}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold" style={{ color: getWowClassColor(row.evidence?.className ?? row.entry.className) }}>{row.entry.playerName}</span>
                    <span className="text-[11px] text-hint">{row.evidence?.primarySpecName ?? '?'} · {RAID_ROLE_LABELS[row.entry.role]} · {row.entry.availability}</span>
                    {decision && <RosterChip tone={decision.decision === 'start' ? 'success' : decision.decision === 'flex' ? 'accent' : 'neutral'}>{DECISION_LABEL[decision.decision]}</RosterChip>}
                    <RosterChip tone={selected ? 'accent' : 'neutral'} active={selected} onClick={() => onToggleCompare(row.entry.playerName)}>{selected ? 'selected' : 'compare'}</RosterChip>
                    {decision && (
                      <RosterSelect
                        className="ml-auto"
                        value={decision.reasonCategory ?? ''}
                        onChange={(event) => onDecisionPatch(row.entry.playerName, { reasonCategory: (event.target.value || null) as RosterReasonCategory | null })}
                      >
                        <option value="">Reason category…</option>
                        {REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </RosterSelect>
                    )}
                  </div>
                  {decision ? (
                    <>
                      <RosterInput
                        value={decision.reasonText}
                        placeholder="Short structured reason, e.g. “Selected: required Mage for composition; performance comparable to X.”"
                        onChange={(event) => onDecisionPatch(row.entry.playerName, { reasonText: event.target.value })}
                      />
                      <div className="flex flex-wrap gap-1">
                        {templates.map((template) => (
                          <RosterChip key={template} tone="neutral" onClick={() => onDecisionPatch(row.entry.playerName, { reasonText: template })} title="Insert template (edit placeholders afterwards)">
                            {template.length > 64 ? `${template.slice(0, 64)}…` : template}
                          </RosterChip>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-hint">No decision yet. Set one in the Select step.</p>
                  )}
                </div>
              )
            })}
          </div>
        )
      })}

      <div className="flex flex-col gap-1.5">
        <RosterSectionTitle>Comparison notes ({comparisonNotes.length})</RosterSectionTitle>
        {comparisonNotes.length === 0 && <p className="text-[11px] text-hint">Saved comparisons appear here and in the export.</p>}
        {comparisonNotes.map((note) => (
          <div key={note.id} className="rounded-lg border border-white/[0.06] bg-[rgba(26,27,30,0.6)] px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-100">{note.playerA} vs {note.playerB}</span>
              <RosterButton tone="danger" onClick={() => onRemoveComparisonNote(note.id)}>Remove</RosterButton>
            </div>
            <pre className="mt-1 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-300">{note.text}</pre>
          </div>
        ))}
      </div>

      <div className="flex justify-between">
        <RosterButton onClick={onBack}>← Select</RosterButton>
        <RosterButton tone="primary" onClick={onContinue}>Continue to export →</RosterButton>
      </div>
    </div>
  )
}
