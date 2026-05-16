import type { FC } from 'react'
import type { ReportSummary } from '@/features/reports/types/report-summary'
import type { PlayerAnalysisTimeframePreset } from '../types/player-analysis.types'

type RecentPlayer = { name: string }

type Props = {
  players: RecentPlayer[]
  reports: ReportSummary[]
  playerName: string
  timeframePreset: PlayerAnalysisTimeframePreset
  selectedReports: string[]
  includeKills: boolean
  includeWipes: boolean
  includeTrash: boolean
  onlyPlayerPresent: boolean
  onPlayerNameChange: (value: string) => void
  onTimeframePresetChange: (value: PlayerAnalysisTimeframePreset) => void
  onSelectedReportsChange: (value: string[]) => void
  onIncludeKillsChange: (value: boolean) => void
  onIncludeWipesChange: (value: boolean) => void
  onIncludeTrashChange: (value: boolean) => void
  onOnlyPlayerPresentChange: (value: boolean) => void
  onPreview: () => void
  isPreviewing: boolean
}

export const PlayerAnalysisScopeForm: FC<Props> = ({
  players,
  reports,
  playerName,
  timeframePreset,
  selectedReports,
  includeKills,
  includeWipes,
  includeTrash,
  onlyPlayerPresent,
  onPlayerNameChange,
  onTimeframePresetChange,
  onSelectedReportsChange,
  onIncludeKillsChange,
  onIncludeWipesChange,
  onIncludeTrashChange,
  onOnlyPlayerPresentChange,
  onPreview,
  isPreviewing,
}) => (
  <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
    <h2 className="text-sm font-semibold text-slate-200">Export Scope</h2>
    <p className="mt-1 text-xs text-slate-400">Enter a character name to get started.</p>

    <label className="mt-3 block text-xs font-medium text-slate-300">Character name</label>
    <input
      className="mt-1 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-violet-500 focus:outline-none"
      list="player-analysis-recent-players"
      value={playerName}
      onChange={(e) => onPlayerNameChange(e.target.value)}
      placeholder="Start typing a character name..."
      autoComplete="off"
      aria-label="Character name"
    />
    <datalist id="player-analysis-recent-players">
      {players.map((p) => (
        <option key={p.name} value={p.name} />
      ))}
    </datalist>

    <label className="mt-3 block text-xs text-slate-400">Timeframe</label>
    <select
      value={timeframePreset}
      onChange={(e) => onTimeframePresetChange(e.target.value as PlayerAnalysisTimeframePreset)}
      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
    >
      <option value="last7Days">Last 7 days</option>
      <option value="last14Days">Last 14 days</option>
      <option value="previousCalendarWeek">Previous calendar week</option>
      <option value="manualReports">Manual report selection</option>
    </select>

    {timeframePreset === 'manualReports' && (
      <>
        <label className="mt-3 block text-xs text-slate-400">Reports (hold Ctrl/Cmd to multi-select)</label>
        <select
          multiple
          value={selectedReports}
          onChange={(e) => onSelectedReportsChange(Array.from(e.target.selectedOptions).map((o) => o.value))}
          className="mt-1 h-40 w-full rounded border border-slate-700 bg-slate-950 p-2 text-xs text-slate-100"
        >
          {reports.map((report) => (
            <option key={report.code} value={report.code}>
              {report.title} ({new Date(report.startTime).toLocaleDateString()})
            </option>
          ))}
        </select>
      </>
    )}

    <div className="mt-3 space-y-1.5 text-xs text-slate-300">
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={onlyPlayerPresent} onChange={(e) => onOnlyPlayerPresentChange(e.target.checked)} />
        Only fights where player is present
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={includeKills} onChange={(e) => onIncludeKillsChange(e.target.checked)} />
        Include kills
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={includeWipes} onChange={(e) => onIncludeWipesChange(e.target.checked)} />
        Include wipes
      </label>
      <label className="flex items-center gap-2 opacity-50" title="Trash fights are not available via the WCL structured reports API">
        <input type="checkbox" checked={includeTrash} onChange={(e) => onIncludeTrashChange(e.target.checked)} disabled />
        Include trash <span className="text-slate-500">(not available from WCL)</span>
      </label>
    </div>

    <button
      type="button"
      onClick={onPreview}
      disabled={isPreviewing || !playerName.trim()}
      className="mt-4 w-full rounded border border-cyan-600 bg-cyan-700/20 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-700/30 disabled:opacity-60"
    >
      {isPreviewing ? 'Previewing…' : 'Preview export'}
    </button>
  </section>
)
