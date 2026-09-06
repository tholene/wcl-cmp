import type { FC } from 'react'
import type { RosterReviewRow } from '../lib/evidence-grouping'
import type { RosterEvidenceJob, RosterEvidenceResult } from '../types/roster-review.types'
import { EvidenceTable } from './evidence-table'
import { ParseHelp } from './parse-help'
import { PlayerEvidenceDetails } from './player-evidence-details'
import { RosterButton, RosterSectionTitle } from './roster-ui'

type EvidenceStepProps = {
  rows: RosterReviewRow[]
  evidence: RosterEvidenceResult | null
  job: RosterEvidenceJob | undefined
  isRunning: boolean
  isStarting: boolean
  error: string | null
  selectedForCompare: string[]
  detailsPlayer: string | null
  onBuild: () => void
  onApplySuggestedRoles: () => void
  onToggleCompare: (playerName: string) => void
  onOpenDetails: (playerName: string | null) => void
  onBack: () => void
  onContinue: () => void
}

export const EvidenceStep: FC<EvidenceStepProps> = ({
  rows, evidence, job, isRunning, isStarting, error, selectedForCompare, detailsPlayer,
  onBuild, onApplySuggestedRoles, onToggleCompare, onOpenDetails, onBack, onContinue,
}) => {
  const detailsEvidence = detailsPlayer ? rows.find((row) => row.entry.playerName === detailsPlayer)?.evidence ?? null : null
  const reportUrls = Object.fromEntries((evidence?.reports ?? []).map((report) => [report.code, report.url]))
  const unknownRoleCount = rows.filter((row) => row.entry.role === 'unknown' && row.evidence?.primarySpecName).length
  const missingFromRun = rows.filter((row) => !row.evidence).length

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Pull the strongest practical Warcraft Logs evidence for every listed player: per-boss overall and ilvl-bracket parses,
        item level, raw output, log presence and deaths on kill fights. One player failing does not stop the others.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <RosterButton tone="primary" onClick={onBuild} disabled={isRunning || isStarting || rows.length === 0}>
          {isStarting ? 'Starting…' : isRunning ? 'Building…' : evidence ? 'Rebuild evidence' : 'Build evidence'}
        </RosterButton>
        {evidence && (
          <span className="text-[11px] text-hint">
            Built {new Date(evidence.generatedAt).toLocaleString()} · {evidence.reports.filter((r) => r.loaded).length}/{evidence.reports.length} reports · {evidence.players.length} players
          </span>
        )}
        {evidence && unknownRoleCount > 0 && (
          <RosterButton onClick={onApplySuggestedRoles} title="Sets raid role from the WCL-detected spec for players whose role is still unknown">
            Apply WCL-suggested roles ({unknownRoleCount})
          </RosterButton>
        )}
      </div>

      {error && <div className="alert-error">{error}</div>}

      {job && (isRunning || job.status === 'failed') && (
        <div className="flex flex-col gap-2 rounded-lg border border-white/[0.06] bg-[rgba(26,27,30,0.6)] p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-200">{job.currentStep}</span>
            <span className="tabular-nums text-hint">{job.percentComplete}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded bg-[#2b2d31]">
            <div className={`h-full rounded transition-[width] duration-500 ${job.status === 'failed' ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(job.percentComplete, 100)}%` }} />
          </div>
          <div className="text-[11px] text-hint">{job.completedSteps} / {job.totalSteps} steps</div>
          {job.status === 'failed' && <div className="alert-error">{job.error ?? 'Evidence collection failed.'}</div>}
          {job.warnings.length > 0 && <div className="alert-warning">{job.warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}</div>}
        </div>
      )}

      {evidence && !isRunning && (
        <>
          {(evidence.warnings.length > 0 || missingFromRun > 0) && (
            <details className="alert-warning">
              <summary className="cursor-pointer">
                {evidence.warnings.length + (missingFromRun > 0 ? 1 : 0)} data warning(s) — evidence is incomplete in places
              </summary>
              <div className="mt-2 space-y-1">
                {missingFromRun > 0 && <p>⚠ {missingFromRun} listed player(s) were added after the last build. Rebuild to include them.</p>}
                {evidence.warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}
              </div>
            </details>
          )}

          <ParseHelp />

          <RosterSectionTitle right={<span className="text-[11px] text-hint">Click a column to sort · click a name for boss-by-boss detail</span>}>
            Evidence
          </RosterSectionTitle>
          <EvidenceTable rows={rows} selectedForCompare={selectedForCompare} onToggleCompare={onToggleCompare} onOpenDetails={onOpenDetails} />

          {detailsEvidence && <PlayerEvidenceDetails evidence={detailsEvidence} reportUrls={reportUrls} onClose={() => onOpenDetails(null)} />}
        </>
      )}

      <div className="flex justify-between">
        <RosterButton onClick={onBack}>← Availability</RosterButton>
        <RosterButton tone="primary" disabled={!evidence} onClick={onContinue}>Continue to selection →</RosterButton>
      </div>
    </div>
  )
}
