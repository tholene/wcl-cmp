import type { FC } from 'react'
import type { PlayerAnalysisExportPreview } from '../types/player-analysis.types'

const SIZE_LABELS: Record<string, string> = {
  small: 'Small (< 10 fights)',
  medium: 'Medium (10–30 fights)',
  large: 'Large (30–60 fights)',
  veryLarge: 'Very large (> 60 fights)',
}

type Props = {
  preview: PlayerAnalysisExportPreview
  selectedFightIdsByReport: Record<string, number[]>
  onFightSelectionChange: (reportCode: string, fightId: number, selected: boolean) => void
  onAnalyzeSingleBoss: () => void
  onSelectAllEligibleFights: () => void
  onClearFightSelection: () => void
  onGenerateExport: () => void
  isGenerating: boolean
  viewCount: number
  exportBlockedReason?: string | null
}

export const PlayerAnalysisPreviewPanel: FC<Props> = ({
  preview,
  selectedFightIdsByReport,
  onFightSelectionChange,
  onAnalyzeSingleBoss,
  onSelectAllEligibleFights,
  onClearFightSelection,
  onGenerateExport,
  isGenerating,
  viewCount,
  exportBlockedReason,
}) => {
  const player = preview.detectedPlayer
  const selectedFightCount = Object.values(selectedFightIdsByReport).reduce((sum, fightIds) => sum + fightIds.length, 0)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-200">Step 2: Raid and Boss Selection</h2>

      <div className="rounded border border-slate-700 bg-slate-950/50 p-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-400">Reports scanned</span>
          <span className="text-slate-200">{preview.scope.reportsScanned}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Reports included</span>
          <span className="text-slate-200">{preview.scope.reportsIncluded}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Fights scanned</span>
          <span className="text-slate-200">{preview.scope.fightsScanned}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Fights included</span>
          <span className="text-slate-200">{preview.scope.fightsIncluded}</span>
        </div>
      </div>

      {player && (
        <div className="rounded border border-slate-700 bg-slate-950/50 p-3 space-y-1 text-xs">
          <p className="font-medium text-slate-300">{player.characterName}</p>

          {player.detectedContext && player.detectedContext.confidence === 'high' && (
            <>
              <div className="flex gap-3 text-slate-400">
                <span>Class: <span className="text-slate-200">{player.detectedContext.className}</span></span>
                <span>Spec: <span className="text-slate-200">{player.detectedContext.specName}</span></span>
                <span>Role: <span className="text-slate-200">{player.detectedContext.role?.toUpperCase()}</span></span>
              </div>
              <p className="text-slate-500">
                Source: WCL CombatantInfo{player.detectedContext.specId ? ` (specID ${player.detectedContext.specId})` : ''}
              </p>
            </>
          )}

          {player.detectedContext && player.detectedContext.confidence === 'medium' && (
            <>
              <div className="flex gap-3 text-slate-400">
                <span>Class: <span className="text-slate-200">{player.detectedContext.className}</span></span>
                <span className="text-amber-400">Spec not detected</span>
              </div>
              <p className="text-slate-500">Source: WCL actor data</p>
            </>
          )}

          {(!player.detectedContext || player.detectedContext.confidence === 'low') && (
            <p className="text-amber-400">Spec could not be detected from WCL data.</p>
          )}

          {player.detectionDiagnostics && player.detectedContext?.confidence !== 'high' && (
            <div className="mt-0.5 space-y-0.5 text-xs text-slate-500">
              {!player.detectionDiagnostics.playerActorFound && (
                <p>Player actor not found in report masterData.</p>
              )}
              {player.detectionDiagnostics.combatantInfoQueried && player.detectionDiagnostics.combatantInfoEventsFound === 0 && (
                <p>CombatantInfo queried but returned no events for checked fight(s).</p>
              )}
              {player.detectionDiagnostics.matchingCombatantInfoFound && !player.detectionDiagnostics.specIdMapped && (
                <p>specID {player.detectionDiagnostics.rawSpecIdFound} found but not in spec map.</p>
              )}
              {player.detectionDiagnostics.fightsAttempted > 0 && (
                <p>{player.detectionDiagnostics.fightsAttempted} fight(s) checked for spec detection.</p>
              )}
            </div>
          )}

          {player.itemLevel !== null && (
            <p className="text-slate-400">Item level: <span className="text-slate-200">{player.itemLevel}</span></p>
          )}
          {player.warnings.map((w) => (
            <p key={w} className="text-amber-300">⚠ {w}</p>
          ))}
        </div>
      )}

      {!player && (
        <div className="rounded border border-amber-700/30 bg-amber-950/20 p-2 text-xs text-amber-300">
          Player not detected in any included reports.
        </div>
      )}

      <div className="rounded border border-slate-700 bg-slate-950/50 p-3 space-y-1 text-xs">
        <p className="text-slate-400">
          Estimated size: <span className="text-slate-200">{SIZE_LABELS[preview.estimatedExport.estimatedSizeLevel] ?? preview.estimatedExport.estimatedSizeLevel}</span>
        </p>
        <p className="text-slate-400">
          CSV files: <span className="text-slate-200">~{preview.estimatedExport.estimatedCsvFiles}</span>
        </p>
        {preview.estimatedExport.warnings.map((w) => (
          <p key={w} className="text-amber-300">⚠ {w}</p>
        ))}
      </div>

      {preview.warnings.length > 0 && (
        <div className="rounded border border-amber-700/30 bg-amber-950/20 p-2 space-y-1 text-xs text-amber-200">
          {preview.warnings.map((w) => (
            <p key={w}>⚠ {w}</p>
          ))}
        </div>
      )}

      <div className="rounded border border-slate-700 bg-slate-950/50 p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <p className="text-slate-300">Fight selection</p>
          <div className="flex items-center gap-2 text-slate-500">
            <button type="button" className="hover:text-slate-300" onClick={onAnalyzeSingleBoss}>
              Analyze this boss
            </button>
            <button type="button" className="hover:text-slate-300" onClick={onSelectAllEligibleFights}>
              Include more fights
            </button>
            <button type="button" className="hover:text-slate-300" onClick={onClearFightSelection}>
              Clear
            </button>
          </div>
        </div>
        <p className="text-slate-500">
          Default selection is one player-present boss fight (prefers kills). Use "Include more fights" for advanced multi-fight exports.
        </p>
        <p className="text-slate-400">
          Selected fights: <span className="text-slate-200">{selectedFightCount}</span>
        </p>

        {preview.includedReports.length === 0 && (
          <p className="text-slate-500">No reports available in current scope.</p>
        )}

        {preview.includedReports.map((report) => (
          <div key={report.code} className="rounded border border-slate-800 bg-slate-950/40 p-2">
            <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <a href={report.url} target="_blank" rel="noreferrer" className="font-medium text-cyan-300 hover:text-cyan-200">
                {report.title}
              </a>
              <span className="text-slate-500">({report.code})</span>
              <span className={report.playerPresent ? 'text-emerald-300' : 'text-amber-300'}>
                {report.playerPresent ? 'player present' : 'player absent'}
              </span>
            </div>

            {report.includedFights.length === 0 && (
              <p className="text-slate-500">No fights included from this report.</p>
            )}

            {report.includedFights.length > 0 && (
              <div className="space-y-1">
                {report.includedFights.map((fight) => {
                  const checked = selectedFightIdsByReport[report.code]?.includes(fight.fightId) ?? false
                  return (
                    <label
                      key={`${report.code}:${fight.fightId}`}
                      className="grid grid-cols-[auto,1fr] gap-2 rounded border border-slate-800 bg-slate-900/50 p-2 text-slate-300"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => onFightSelectionChange(report.code, fight.fightId, e.target.checked)}
                      />
                      <div className="grid gap-0.5 md:grid-cols-2">
                        <span className="font-medium text-slate-200">{fight.encounterName}</span>
                        <span className="text-slate-400">Fight ID: {fight.fightId}</span>
                        <span className="text-slate-400">Difficulty: {fight.difficulty}</span>
                        <span className={fight.kill ? 'text-emerald-300' : 'text-rose-300'}>
                          {fight.kill ? 'Kill' : 'Wipe'}
                        </span>
                        <span className="text-slate-400">Duration: {Math.round(fight.durationMs / 1000)}s</span>
                        <span className={fight.playerPresent ? 'text-emerald-300' : 'text-amber-300'}>
                          {fight.playerPresent ? 'Player present' : 'Player absent'}
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onGenerateExport}
        disabled={isGenerating || selectedFightCount === 0 || viewCount === 0 || !!exportBlockedReason}
        className="w-full rounded border border-violet-600 bg-violet-700/20 px-3 py-2 text-sm font-medium text-violet-200 hover:bg-violet-700/30 disabled:opacity-60"
      >
        {isGenerating ? 'Starting export…' : 'Export analysis bundle'}
      </button>

      {preview.scope.fightsIncluded === 0 && (
        <p className="text-xs text-rose-300">No fights match the current filters — adjust scope to proceed.</p>
      )}
      {selectedFightCount === 0 && (
        <p className="text-xs text-rose-300">Select at least one fight to export.</p>
      )}
      {viewCount === 0 && (
        <p className="text-xs text-rose-300">No views selected — select at least one export view.</p>
      )}
      {exportBlockedReason && (
        <p className="text-xs text-amber-300">{exportBlockedReason}</p>
      )}
    </div>
  )
}
