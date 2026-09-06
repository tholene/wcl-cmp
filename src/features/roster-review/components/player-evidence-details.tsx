import type { FC } from 'react'
import { DiffBadge } from '@/features/player-analysis/components/diff-badge'
import { formatDuration } from '@/features/player-analysis/lib/player-analysis-utils'
import { formatAmount, formatDate, formatPercentile } from '../lib/roster-format'
import type { RosterPlayerEvidence } from '../types/roster-review.types'
import { RosterButton, RosterSectionTitle } from './roster-ui'

type PlayerEvidenceDetailsProps = {
  evidence: RosterPlayerEvidence
  reportUrls: Record<string, string>
  onClose: () => void
}

export const PlayerEvidenceDetails: FC<PlayerEvidenceDetailsProps> = ({ evidence, reportUrls, onClose }) => (
  <div className="flex flex-col gap-3 rounded-lg border border-white/[0.08] bg-[rgba(43,45,49,0.7)] p-3">
    <RosterSectionTitle right={<RosterButton onClick={onClose}>Close</RosterButton>}>
      {evidence.playerName} · boss-by-boss
    </RosterSectionTitle>
    {evidence.warnings.length > 0 && (
      <div className="alert-warning">{evidence.warnings.map((warning) => <p key={warning}>⚠ {warning}</p>)}</div>
    )}
    {evidence.signals.length > 0 && (
      <ul className="space-y-1 text-[11px] text-slate-300">
        {evidence.signals.map((signal) => (
          <li key={signal.code}><span className="font-semibold text-slate-100">{signal.label}:</span> {signal.detail}</li>
        ))}
      </ul>
    )}
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[11px]">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-hint">
            <th className="px-2 py-1">Boss</th>
            <th className="px-2 py-1">Date</th>
            <th className="px-2 py-1">Result</th>
            <th className="px-2 py-1">Present</th>
            <th className="px-2 py-1">Spec</th>
            <th className="px-2 py-1">Overall</th>
            <th className="px-2 py-1">Bracket</th>
            <th className="px-2 py-1">Ilvl</th>
            <th className="px-2 py-1">Output</th>
            <th className="px-2 py-1">Deaths</th>
            <th className="px-2 py-1">Log</th>
          </tr>
        </thead>
        <tbody>
          {evidence.fights.map((fight) => (
            <tr key={`${fight.reportCode}:${fight.fightId}`} className="border-t border-white/[0.05] text-slate-300">
              <td className="px-2 py-1"><span className="flex items-center gap-1.5">{fight.encounterName} <DiffBadge difficulty={fight.difficulty} /></span></td>
              <td className="px-2 py-1 text-hint">{formatDate(fight.startTime)}</td>
              <td className="px-2 py-1">{fight.kill ? <span className="text-emerald-300">kill</span> : <span className="text-hint">wipe</span>} <span className="text-hint">{formatDuration(fight.durationMs)}</span></td>
              <td className="px-2 py-1">{fight.present === null ? <span className="text-hint">unknown</span> : fight.present ? 'yes' : <span className="text-amber-300">no</span>}</td>
              <td className="px-2 py-1">{fight.ranking?.specName ?? '—'}</td>
              <td className="px-2 py-1 tabular-nums">
                {formatPercentile(fight.ranking?.overallPercentile)}
                {fight.ranking?.overallSource === 'derivedFromRank' && <span className="ml-1 text-hint" title="Derived from rank/total parses">*</span>}
                {fight.ranking && <span className="ml-1 text-[9px] text-hint">{fight.ranking.timeframe}</span>}
              </td>
              <td className="px-2 py-1 tabular-nums text-sky-200">{formatPercentile(fight.ranking?.bracketPercentile)}</td>
              <td className="px-2 py-1 tabular-nums">{fight.ranking?.itemLevel ?? '—'}</td>
              <td className="px-2 py-1 tabular-nums">{formatAmount(fight.ranking?.amount)}</td>
              <td className="px-2 py-1 tabular-nums">
                {!fight.kill ? <span className="text-hint">n/a</span> : fight.deaths === null ? <span className="text-hint">unknown</span> : fight.deaths.count === 0 ? '0' : `${fight.deaths.count} (${fight.deaths.timesMs.map((t) => formatDuration(t)).join(', ')})`}
              </td>
              <td className="px-2 py-1">
                {reportUrls[fight.reportCode] ? (
                  <a href={`${reportUrls[fight.reportCode]}#fight=${fight.fightId}`} target="_blank" rel="noreferrer" className="text-indigo-300 hover:underline">WCL ↗</a>
                ) : fight.reportCode}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)
