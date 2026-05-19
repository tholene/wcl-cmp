import type { FC } from 'react'
import type { ReportSummary } from '@/features/reports/types/report-summary'
import type { PlayerAnalysisTimeframePreset } from '../types/player-analysis.types'

type RecentPlayer = { name: string }

type Props = {
  players: RecentPlayer[]
  reports: ReportSummary[]
  latestRaidReportCodes: string[]
  recentPlayersLoading: boolean
  recentPlayersError: string | null
  reportsLoading: boolean
  reportsError: string | null
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
  previewButtonLabel?: string
}

export const PlayerAnalysisScopeForm: FC<Props> = ({
  players,
  reports,
  latestRaidReportCodes,
  recentPlayersLoading,
  recentPlayersError,
  reportsLoading,
  reportsError,
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
  previewButtonLabel = 'Preview latest raid',
}) => (
  <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
    <h2 className="text-sm font-semibold text-slate-200">Step 1: Player and Scope</h2>
    <p className="mt-1 text-xs text-slate-400">Pick a player, then preview raids/bosses for analysis.</p>

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
    {recentPlayersLoading && (
      <p className="mt-1 text-xs text-slate-500">Loading recent guild players for autocomplete…</p>
    )}
    {recentPlayersError && (
      <p className="mt-1 text-xs text-amber-300">
        Could not load autocomplete suggestions. Manual player entry still works.
      </p>
    )}

    <label className="mt-3 block text-xs text-slate-400">Scope mode</label>
    <select
      value={timeframePreset}
      onChange={(e) => onTimeframePresetChange(e.target.value as PlayerAnalysisTimeframePreset)}
      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
    >
      <option value="latestRaid">Latest raid (default)</option>
      <option value="last7Days">Last 7 days</option>
      <option value="last14Days">Last 14 days</option>
      <option value="previousCalendarWeek">Previous calendar week</option>
      <option value="manualReports">Manual report selection</option>
    </select>

    {timeframePreset === 'latestRaid' && (
      <div className="mt-3 rounded border border-slate-700 bg-slate-950/40 p-2 text-xs">
        <p className="text-slate-300">Latest raid default selection</p>
        {reportsLoading && (
          <p className="mt-1 text-slate-500">Loading recent reports…</p>
        )}
        {!reportsLoading && reportsError && (
          <p className="mt-1 text-amber-300">
            Could not load reports locally. Preview can still resolve latest raid on the server.
          </p>
        )}
        {!reportsLoading && !reportsError && latestRaidReportCodes.length === 0 && (
          <p className="mt-1 text-slate-500">No recent raid logs found. Try manual report selection.</p>
        )}
        {!reportsLoading && latestRaidReportCodes.length > 0 && (
          <ul className="mt-1 space-y-1 text-slate-400">
            {latestRaidReportCodes.map((code) => {
              const report = reports.find((item) => item.code === code)
              return (
                <li key={code}>
                  {report?.title ?? 'Unknown report'} ({code})
                </li>
              )
            })}
          </ul>
        )}
      </div>
    )}

    {timeframePreset === 'manualReports' && (
      <>
        <div className="mt-3 flex items-center justify-between">
          <label className="block text-xs text-slate-400">Reports</label>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button
              type="button"
              className="hover:text-slate-300"
              onClick={() => onSelectedReportsChange(reports.map((report) => report.code))}
              disabled={reports.length === 0}
            >
              Select all
            </button>
            <button
              type="button"
              className="hover:text-slate-300"
              onClick={() => onSelectedReportsChange([])}
              disabled={selectedReports.length === 0}
            >
              Clear
            </button>
          </div>
        </div>
        <div className="mt-1 max-h-44 space-y-1 overflow-y-auto rounded border border-slate-700 bg-slate-950 p-2 text-xs">
          {reportsLoading && (
            <p className="text-slate-500">Loading recent reports…</p>
          )}
          {!reportsLoading && reportsError && (
            <p className="text-amber-300">Could not load reports for manual selection.</p>
          )}
          {!reportsLoading && !reportsError && reports.length === 0 && (
            <p className="text-slate-500">No reports available.</p>
          )}
          {!reportsLoading && reports.map((report) => (
            <label key={report.code} className="flex items-start gap-2 text-slate-300">
              <input
                type="checkbox"
                checked={selectedReports.includes(report.code)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selectedReports, report.code]
                    : selectedReports.filter((code) => code !== report.code)
                  onSelectedReportsChange(next)
                }}
              />
              <span>
                {report.title} ({report.code}){' '}
                <span className="text-slate-500">{new Date(report.startTime).toLocaleString()}</span>
              </span>
            </label>
          ))}
        </div>
        {selectedReports.length === 0 && (
          <p className="mt-1 text-xs text-amber-300">Select at least one report for manual scope.</p>
        )}
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
      disabled={isPreviewing || !playerName.trim() || (timeframePreset === 'manualReports' && selectedReports.length === 0)}
      className="mt-4 w-full rounded border border-cyan-600 bg-cyan-700/20 px-3 py-1.5 text-xs text-cyan-200 hover:bg-cyan-700/30 disabled:opacity-60"
    >
      {isPreviewing ? 'Previewing…' : previewButtonLabel}
    </button>
  </section>
)
