import type { FC } from 'react'
import { DiffBadge } from '@/features/player-analysis/components/diff-badge'
import { getDifficultyLabel } from '@/lib/difficulty'
import { cn } from '@/lib/utils'
import { formatDateTime } from '../lib/roster-format'
import type { RosterRaidReport, RosterRaidWindow } from '../types/roster-review.types'
import { RosterButton, RosterChip, RosterField, RosterInput, RosterSectionTitle } from './roster-ui'

type RaidWindowStepProps = {
  raid: RosterRaidWindow
  reports: RosterRaidReport[]
  reportsLoading: boolean
  reportsError: string | null
  reportsWarnings: string[]
  onRaidChange: (patch: Partial<RosterRaidWindow>) => void
  onToggleReport: (code: string) => void
  onToggleEncounter: (encounterId: number) => void
  onRefresh: () => void
  onContinue: () => void
}

const DIFFICULTY_OPTIONS: Array<{ value: number | null; label: string }> = [
  { value: null, label: 'All' },
  { value: 5, label: 'Mythic' },
  { value: 4, label: 'Heroic' },
  { value: 3, label: 'Normal' },
]

export const RaidWindowStep: FC<RaidWindowStepProps> = ({
  raid, reports, reportsLoading, reportsError, reportsWarnings, onRaidChange, onToggleReport, onToggleEncounter, onRefresh, onContinue,
}) => {
  const selectedReports = reports.filter((report) => raid.reportCodes.includes(report.code))
  const encounters = new Map<number, string>()
  for (const report of selectedReports) {
    for (const fight of report.fights) {
      if (raid.difficulty !== null && fight.difficulty !== raid.difficulty) continue
      if (!encounters.has(fight.encounterId)) encounters.set(fight.encounterId, fight.encounterName)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Choose the target raid and the recent logs that serve as evidence. One to three recent raid nights is usually enough; the
        difficulty filter picks which kills count (Heroic logs are the normal source when preparing the first Mythic roster).
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <RosterField label="Target raid" hint="Free text, e.g. “Mythic prog — Wed 10 Sep”. Appears in the export.">
          <RosterInput value={raid.targetRaidLabel} placeholder="Mythic progression — next raid" onChange={(event) => onRaidChange({ targetRaidLabel: event.target.value })} />
        </RosterField>
        <RosterField label="Evidence difficulty" hint="Only fights on this difficulty are used for parses and deaths.">
          <div className="flex gap-1">
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => onRaidChange({ difficulty: option.value, encounterIds: [] })}
                className={cn('tier-btn', raid.difficulty === option.value && 'tier-btn-active')}
              >
                {option.label}
              </button>
            ))}
          </div>
        </RosterField>
      </div>

      <div className="flex flex-col gap-2">
        <RosterSectionTitle right={<RosterButton onClick={onRefresh} disabled={reportsLoading}>{reportsLoading ? 'Loading…' : 'Refresh'}</RosterButton>}>
          Recent raid logs {raid.reportCodes.length > 0 && <span className="text-hint">· {raid.reportCodes.length} selected</span>}
        </RosterSectionTitle>
        {reportsError && <div className="alert-error">{reportsError}</div>}
        {reportsWarnings.map((warning) => <div key={warning} className="alert-warning">{warning}</div>)}
        {reportsLoading && <p className="text-xs text-hint">Fetching recent guild raid reports from Warcraft Logs…</p>}
        {!reportsLoading && reports.length === 0 && !reportsError && (
          <p className="text-xs text-hint">No raid reports found. Check the Guild ID in Settings.</p>
        )}
        <div className="flex flex-col gap-1.5">
          {reports.map((report) => {
            const selected = raid.reportCodes.includes(report.code)
            const kills = Object.entries(report.killCountsByDifficulty).sort((a, b) => Number(b[0]) - Number(a[0]))
            return (
              <button
                key={report.code}
                type="button"
                onClick={() => onToggleReport(report.code)}
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors',
                  selected ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-white/[0.06] bg-[rgba(26,27,30,0.6)] hover:bg-[rgba(43,45,49,0.9)]'
                )}
              >
                <span className={cn('h-4 w-4 shrink-0 rounded border', selected ? 'border-indigo-300 bg-indigo-400' : 'border-white/20')} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-slate-100">{report.title}</span>
                  <span className="block text-[11px] text-hint">
                    {formatDateTime(report.startTime)} · {report.zoneName ?? 'Unknown zone'} · {report.participants.length} players logged
                  </span>
                </span>
                <span className="flex flex-wrap items-center gap-1">
                  {kills.length === 0 && <RosterChip tone="neutral">no kills</RosterChip>}
                  {kills.map(([difficulty, count]) => (
                    <span key={difficulty} className="flex items-center gap-1">
                      <DiffBadge difficulty={Number(difficulty)} />
                      <span className="text-[11px] text-slate-300">{count} kill{count === 1 ? '' : 's'}</span>
                    </span>
                  ))}
                </span>
                <a
                  href={report.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="text-[11px] text-indigo-300 hover:underline"
                >
                  WCL ↗
                </a>
              </button>
            )
          })}
        </div>
      </div>

      {selectedReports.length > 0 && (
        <div className="flex flex-col gap-2">
          <RosterSectionTitle>
            Bosses <span className="text-hint">· optional filter ({raid.difficulty === null ? 'all difficulties' : getDifficultyLabel(raid.difficulty)})</span>
          </RosterSectionTitle>
          {encounters.size === 0 ? (
            <p className="text-xs text-hint">No boss fights on this difficulty in the selected logs. Pick another difficulty or more logs.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {[...encounters.entries()].map(([encounterId, name]) => (
                <RosterChip
                  key={encounterId}
                  tone={raid.encounterIds.includes(encounterId) ? 'accent' : 'neutral'}
                  active={raid.encounterIds.includes(encounterId)}
                  onClick={() => onToggleEncounter(encounterId)}
                >
                  {name}
                </RosterChip>
              ))}
            </div>
          )}
          <p className="text-[11px] text-hint">No boss selected means every boss counts.</p>
        </div>
      )}

      <div className="flex justify-end">
        <RosterButton tone="primary" disabled={raid.reportCodes.length === 0} onClick={onContinue}>
          Continue to availability →
        </RosterButton>
      </div>
    </div>
  )
}
