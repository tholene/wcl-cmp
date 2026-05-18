import { useState, type FC } from 'react'
import { useRecentReports } from '@/features/reports/hooks/use-recent-reports'
import { BenchmarkErrorBoundary } from '../components/benchmark-error-boundary'
import { PlayerAnalysisBenchmarkForm } from '../components/player-analysis-benchmark-form'
import { PlayerAnalysisExportProgress } from '../components/player-analysis-export-progress'
import { PlayerAnalysisExportResults } from '../components/player-analysis-export-results'
import { PlayerAnalysisPreviewPanel } from '../components/player-analysis-preview-panel'
import { PlayerAnalysisScopeForm } from '../components/player-analysis-scope-form'
import { PlayerAnalysisViewsForm } from '../components/player-analysis-views-form'
import { useBenchmarkCandidates } from '../hooks/use-benchmark-candidates'
import { usePlayerAnalysisExportJob } from '../hooks/use-player-analysis-export-job'
import { usePlayerAnalysisPreview } from '../hooks/use-player-analysis-preview'
import { useRecentPlayers } from '../hooks/use-recent-players'
import { STABLE_EXPORT_VIEWS, type BenchmarkCandidatesResponse, type PlayerAnalysisExportView, type PlayerAnalysisTimeframePreset, type SelectedBenchmarkCandidate } from '../types/player-analysis.types'
import type { WowRole } from '../types/wow-class-spec'

type ManualBenchmarkConfig = {
  reportCode: string
  fightId: string
  playerName: string
}

type AutoBenchmarkConfig = {
  targetPercentile: 50 | 75 | 90
  metric: string
  itemLevelWindow: number
  durationWindowPercent: number
}

export type ClassSpecOverride = {
  className: string
  specName: string
  role: WowRole
}

export type AvailableBaseline = {
  key: string // `${reportCode}:${fightId}`
  reportCode: string
  reportTitle: string
  fightId: number
  encounterId: number
  encounterName: string
  difficulty: number
  durationMs: number
  kill: boolean
  playerName: string
  className: string
  specName: string
  itemLevel: number | null
}

function buildSelectedCandidates(
  baselines: AvailableBaseline[],
  candidatesResult: BenchmarkCandidatesResponse | null,
  selectedKeys: Set<string>
): SelectedBenchmarkCandidate[] {
  if (!candidatesResult) return []
  const result: SelectedBenchmarkCandidate[] = []
  for (const group of candidatesResult.groups ?? []) {
    const baseline = baselines.find(
      (b) => b.reportCode === group.baseline.reportCode && b.fightId === group.baseline.fightId
    )
    if (!baseline || !selectedKeys.has(baseline.key)) continue
    const candidate = group.candidates.find((c) => c.validation.hasUsableExportTarget)
    if (!candidate || !candidate.reportCode || typeof candidate.fightId !== 'number') continue
    result.push({
      baselineReportCode: baseline.reportCode,
      baselineFightId: baseline.fightId,
      baselineEncounterId: baseline.encounterId,
      baselineEncounterName: baseline.encounterName,
      baselineDifficulty: baseline.difficulty,
      baselineDurationMs: baseline.durationMs,
      benchmarkPlayerName: candidate.characterName,
      benchmarkReportCode: candidate.reportCode,
      benchmarkFightId: candidate.fightId,
      benchmarkEncounterId: candidate.encounterId,
      benchmarkDifficulty: candidate.difficulty ?? baseline.difficulty,
      benchmarkClassName: candidate.className ?? '',
      benchmarkSpecName: candidate.specName ?? '',
      benchmarkPercentile: candidate.percentile,
      benchmarkItemLevel: candidate.itemLevel ?? undefined,
      benchmarkDurationMs: candidate.durationMs ?? undefined,
    })
  }
  return result
}

export const PlayerAnalysisPage: FC = () => {
  const recentPlayersQuery = useRecentPlayers()
  const recentReportsQuery = useRecentReports()
  const previewMutation = usePlayerAnalysisPreview()
  const exportJob = usePlayerAnalysisExportJob()
  const benchmarkCandidatesMutation = useBenchmarkCandidates()

  const [playerName, setPlayerName] = useState('')
  const [timeframePreset, setTimeframePreset] = useState<PlayerAnalysisTimeframePreset>('last7Days')
  const [selectedReports, setSelectedReports] = useState<string[]>([])
  const [includeKills, setIncludeKills] = useState(true)
  const [includeWipes, setIncludeWipes] = useState(true)
  const [includeTrash, setIncludeTrash] = useState(false)
  const [onlyPlayerPresent, setOnlyPlayerPresent] = useState(true)
  const [selectedViews, setSelectedViews] = useState<PlayerAnalysisExportView[]>([...STABLE_EXPORT_VIEWS])

  const [benchmarkMode, setBenchmarkMode] = useState<'none' | 'manual' | 'auto'>('none')
  const [manualBenchmarkConfig, setManualBenchmarkConfig] = useState<ManualBenchmarkConfig>({
    reportCode: '',
    fightId: '',
    playerName: '',
  })
  const [autoBenchmarkConfig, setAutoBenchmarkConfig] = useState<AutoBenchmarkConfig>({
    targetPercentile: 75,
    metric: 'dps',
    itemLevelWindow: 10,
    durationWindowPercent: 35,
  })
  const [selectedBaselineKeys, setSelectedBaselineKeys] = useState<Set<string>>(new Set())
  const [playerUserContext, setPlayerUserContext] = useState<ClassSpecOverride | null>(null)

  const preview = previewMutation.data ?? null
  const job = exportJob.jobStatus

  // Effective class/spec: prefer WCL-detected, fall back to user-provided
  const wclClassName = preview?.detectedPlayer?.className !== 'unknown' ? (preview?.detectedPlayer?.className ?? null) : null
  const wclSpecName = preview?.detectedPlayer?.specName !== 'unknown' ? (preview?.detectedPlayer?.specName ?? null) : null
  const effectiveClassName = wclClassName ?? playerUserContext?.className ?? null
  const effectiveSpecName = wclSpecName ?? playerUserContext?.specName ?? null
  // true when preview exists but WCL failed to detect spec
  const specDetectionFailed = !!preview && wclSpecName === null

  // Boss fights where the player was present, duration ≥ 60s — available for baseline selection
  const availableBaselines: AvailableBaseline[] = preview
    ? preview.includedReports
        .filter((r) => r.playerPresent)
        .flatMap((r) =>
          r.includedFights
            .filter((f) => (f.encounterId ?? 0) > 0 && f.playerPresent && f.durationMs >= 60000)
            .map((f): AvailableBaseline => ({
              key: `${r.code}:${f.fightId}`,
              reportCode: r.code,
              reportTitle: r.title,
              fightId: f.fightId,
              encounterId: f.encounterId ?? 0,
              encounterName: f.encounterName,
              difficulty: f.difficulty,
              durationMs: f.durationMs,
              kill: f.kill,
              playerName: preview.detectedPlayer?.characterName ?? '',
              className: effectiveClassName ?? 'unknown',
              specName: effectiveSpecName ?? 'unknown',
              itemLevel: preview.detectedPlayer?.itemLevel ?? null,
            }))
        )
    : []

  const contextSource = wclSpecName ? ('wclDetected' as const) : ('userProvided' as const)

  const buildRequest = () => ({
    playerName,
    timeframePreset,
    reportCodes: timeframePreset === 'manualReports' ? selectedReports : undefined,
    includeKills,
    includeWipes,
    includeTrash,
    onlyPlayerPresent,
    views: selectedViews,
    playerContext: playerUserContext
      ? {
          className: playerUserContext.className,
          specName: playerUserContext.specName,
          role: playerUserContext.role,
          source: 'userProvided' as const,
        }
      : undefined,
    ...(benchmarkMode !== 'none'
      ? {
          includeBenchmark: true,
          benchmark: {
            targetPercentile: autoBenchmarkConfig.targetPercentile,
            requireSameClassSpec: true as const,
            itemLevelWindow: autoBenchmarkConfig.itemLevelWindow,
            killDurationWindowPct: autoBenchmarkConfig.durationWindowPercent,
            ...(benchmarkMode === 'manual' &&
            manualBenchmarkConfig.reportCode &&
            manualBenchmarkConfig.fightId &&
            manualBenchmarkConfig.playerName
              ? {
                  manualTarget: {
                    reportCode: manualBenchmarkConfig.reportCode,
                    fightId: Number(manualBenchmarkConfig.fightId),
                    playerName: manualBenchmarkConfig.playerName,
                  },
                }
              : {}),
            ...(benchmarkMode === 'auto'
              ? {
                  selectedCandidates: buildSelectedCandidates(
                    availableBaselines,
                    benchmarkCandidatesMutation.data ?? null,
                    selectedBaselineKeys
                  ),
                  autoConfig: {
                    mode: 'auto' as const,
                    baselines: availableBaselines
                      .filter((b) => selectedBaselineKeys.has(b.key))
                      .map((b) => ({
                        reportCode: b.reportCode,
                        fightId: b.fightId,
                        encounterId: b.encounterId,
                        encounterName: b.encounterName,
                        difficulty: b.difficulty,
                        durationMs: b.durationMs,
                        playerName: b.playerName,
                        className: b.className,
                        specName: b.specName,
                        itemLevel: b.itemLevel,
                        contextSource,
                      })),
                    targetPercentile: autoBenchmarkConfig.targetPercentile,
                    metric: autoBenchmarkConfig.metric,
                    itemLevelWindow: autoBenchmarkConfig.itemLevelWindow,
                    durationWindowPercent: autoBenchmarkConfig.durationWindowPercent,
                  },
                }
              : {}),
          },
        }
      : {}),
  })

  const handlePreview = () => {
    setSelectedBaselineKeys(new Set())
    setPlayerUserContext(null)
    previewMutation.mutate(buildRequest(), {
      onSuccess: (data) => {
        // Auto-select kills by default
        const defaultKeys = new Set(
          data.includedReports
            .filter((r) => r.playerPresent)
            .flatMap((r) =>
              r.includedFights
                .filter((f) => (f.encounterId ?? 0) > 0 && f.kill && f.playerPresent && f.durationMs >= 60000)
                .map((f) => `${r.code}:${f.fightId}`)
            )
        )
        setSelectedBaselineKeys(defaultKeys)
      },
    })
  }

  const handleGenerateExport = async () => {
    if (selectedViews.length === 0) return
    await exportJob.startExport(buildRequest())
  }

  const handleFindCandidates = () => {
    if (!preview || selectedBaselineKeys.size === 0 || !preview.detectedPlayer) return
    const baselines = availableBaselines
      .filter((b) => selectedBaselineKeys.has(b.key))
      .map((b) => ({
        reportCode: b.reportCode,
        fightId: b.fightId,
        encounterId: b.encounterId,
        encounterName: b.encounterName,
        difficulty: b.difficulty,
        durationMs: b.durationMs,
        playerName: b.playerName,
        className: b.className,
        specName: b.specName,
        itemLevel: b.itemLevel,
        contextSource,
      }))
    benchmarkCandidatesMutation.mutate({
      baselines,
      targetPercentile: autoBenchmarkConfig.targetPercentile,
      metric: autoBenchmarkConfig.metric,
      itemLevelWindow: autoBenchmarkConfig.itemLevelWindow,
      durationWindowPercent: autoBenchmarkConfig.durationWindowPercent,
      maxCandidatesPerFight: 10,
      playerContext: playerUserContext
        ? { ...playerUserContext, source: 'userProvided' as const }
        : undefined,
    })
  }

  const canFindCandidates =
    !!preview &&
    selectedBaselineKeys.size > 0 &&
    !!preview.detectedPlayer &&
    !!effectiveClassName &&
    !!effectiveSpecName

  const showProgress = exportJob.isStarting || job !== null
  const showResults = job?.status === 'complete' || job?.status === 'partial'

  const players = recentPlayersQuery.data?.players ?? []
  const reports = recentReportsQuery.data?.reports ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Player Analysis Export</h1>
        <p className="mt-0.5 text-xs text-slate-400">Export Warcraft Logs data for a player without manually opening WCL tabs.</p>
      </div>

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
          <BenchmarkErrorBoundary>
            <PlayerAnalysisBenchmarkForm
              benchmarkMode={benchmarkMode}
              benchmarkConfig={manualBenchmarkConfig}
              autoConfig={autoBenchmarkConfig}
              candidatesResult={benchmarkCandidatesMutation.data ?? null}
              isFindingCandidates={benchmarkCandidatesMutation.isPending}
              canFindCandidates={canFindCandidates}
              availableBaselines={availableBaselines}
              selectedBaselineKeys={selectedBaselineKeys}
              specDetectionFailed={specDetectionFailed}
              playerUserContext={playerUserContext}
              onBaselineSelectionChange={setSelectedBaselineKeys}
              onClassSpecOverrideChange={setPlayerUserContext}
              onBenchmarkModeChange={setBenchmarkMode}
              onBenchmarkConfigChange={setManualBenchmarkConfig}
              onAutoConfigChange={setAutoBenchmarkConfig}
              onFindCandidates={handleFindCandidates}
            />
          </BenchmarkErrorBoundary>
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
