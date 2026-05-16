import { useState, type FC } from 'react'
import { useRecentReports } from '@/features/reports/hooks/use-recent-reports'
import { PlayerAnalysisBenchmarkForm } from '../components/player-analysis-benchmark-form'
import { PlayerAnalysisExportProgress } from '../components/player-analysis-export-progress'
import { PlayerAnalysisExportResults } from '../components/player-analysis-export-results'
import { PlayerAnalysisPreviewPanel } from '../components/player-analysis-preview-panel'
import { PlayerAnalysisScopeForm } from '../components/player-analysis-scope-form'
import { PlayerAnalysisViewsForm } from '../components/player-analysis-views-form'
import { usePlayerAnalysisExportJob } from '../hooks/use-player-analysis-export-job'
import { usePlayerAnalysisPreview } from '../hooks/use-player-analysis-preview'
import { useRecentPlayers } from '../hooks/use-recent-players'
import { STABLE_EXPORT_VIEWS, type PlayerAnalysisExportView, type PlayerAnalysisTimeframePreset } from '../types/player-analysis.types'

type BenchmarkConfig = {
  reportCode: string
  fightId: string
  playerName: string
}

export const PlayerAnalysisPage: FC = () => {
  const recentPlayersQuery = useRecentPlayers()
  const recentReportsQuery = useRecentReports()
  const previewMutation = usePlayerAnalysisPreview()
  const exportJob = usePlayerAnalysisExportJob()

  const [playerName, setPlayerName] = useState('')
  const [timeframePreset, setTimeframePreset] = useState<PlayerAnalysisTimeframePreset>('last7Days')
  const [selectedReports, setSelectedReports] = useState<string[]>([])
  const [includeKills, setIncludeKills] = useState(true)
  const [includeWipes, setIncludeWipes] = useState(true)
  const [includeTrash, setIncludeTrash] = useState(false)
  const [onlyPlayerPresent, setOnlyPlayerPresent] = useState(true)
  const [selectedViews, setSelectedViews] = useState<PlayerAnalysisExportView[]>([...STABLE_EXPORT_VIEWS])
  const [includeBenchmark, setIncludeBenchmark] = useState(false)
  const [benchmarkConfig, setBenchmarkConfig] = useState<BenchmarkConfig>({ reportCode: '', fightId: '', playerName: '' })

  const preview = previewMutation.data ?? null
  const job = exportJob.jobStatus

  const buildRequest = () => ({
    playerName,
    timeframePreset,
    reportCodes: timeframePreset === 'manualReports' ? selectedReports : undefined,
    includeKills,
    includeWipes,
    includeTrash,
    onlyPlayerPresent,
    views: selectedViews,
    ...(includeBenchmark && benchmarkConfig.reportCode && benchmarkConfig.fightId && benchmarkConfig.playerName
      ? {
          includeBenchmark: true,
          benchmark: {
            targetPercentile: 75 as const,
            requireSameClassSpec: true as const,
            manualTarget: {
              reportCode: benchmarkConfig.reportCode,
              fightId: Number(benchmarkConfig.fightId),
              playerName: benchmarkConfig.playerName,
            },
          },
        }
      : {}),
  })

  const handlePreview = () => {
    previewMutation.mutate(buildRequest())
  }

  const handleGenerateExport = async () => {
    if (selectedViews.length === 0) return
    await exportJob.startExport(buildRequest())
  }

  const showProgress = exportJob.isStarting || job !== null
  const showResults = job?.status === 'complete' || job?.status === 'partial'

  const players = recentPlayersQuery.data?.players ?? []
  const reports = recentReportsQuery.data?.reports ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-100">Player Analysis Export</h1>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <PlayerAnalysisScopeForm
            players={players}
            reports={reports}
            playerName={playerName}
            timeframePreset={timeframePreset}
            selectedReports={selectedReports}
            includeKills={includeKills}
            includeWipes={includeWipes}
            includeTrash={includeTrash}
            onlyPlayerPresent={onlyPlayerPresent}
            onPlayerNameChange={setPlayerName}
            onTimeframePresetChange={setTimeframePreset}
            onSelectedReportsChange={setSelectedReports}
            onIncludeKillsChange={setIncludeKills}
            onIncludeWipesChange={setIncludeWipes}
            onIncludeTrashChange={setIncludeTrash}
            onOnlyPlayerPresentChange={setOnlyPlayerPresent}
            onPreview={handlePreview}
            isPreviewing={previewMutation.isPending}
          />
          <PlayerAnalysisViewsForm
            selectedViews={selectedViews}
            onSelectedViewsChange={setSelectedViews}
          />
          <PlayerAnalysisBenchmarkForm
            includeBenchmark={includeBenchmark}
            benchmarkConfig={benchmarkConfig}
            onIncludeBenchmarkChange={setIncludeBenchmark}
            onBenchmarkConfigChange={setBenchmarkConfig}
          />
        </div>

        <div className="space-y-4">
          {previewMutation.error && (
            <div className="rounded border border-rose-700/40 bg-rose-950/20 p-3 text-xs text-rose-200">
              {(previewMutation.error as Error).message}
            </div>
          )}

          {preview && !showProgress && (
            <PlayerAnalysisPreviewPanel
              preview={preview}
              onGenerateExport={handleGenerateExport}
              isGenerating={exportJob.isStarting}
              viewCount={selectedViews.length}
            />
          )}

          {showProgress && !showResults && job && (
            <PlayerAnalysisExportProgress job={job} />
          )}

          {exportJob.isStarting && !job && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-400">
              Starting export…
            </div>
          )}

          {exportJob.startError && (
            <div className="rounded border border-rose-700/40 bg-rose-950/20 p-3 text-xs text-rose-200">
              {exportJob.startError}
            </div>
          )}

          {!preview && !showProgress && !previewMutation.isPending && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-500">
              Enter a player name and click "Preview export" to get started.
            </div>
          )}
        </div>

        <div className="space-y-4">
          {showResults && job && exportJob.exportId && (
            <PlayerAnalysisExportResults
              job={job}
              exportId={exportJob.exportId}
              onReset={exportJob.reset}
            />
          )}

          {job?.status === 'failed' && (
            <button
              type="button"
              onClick={exportJob.reset}
              className="w-full rounded border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
