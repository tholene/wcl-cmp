import { useReducer, useRef, useState } from 'react'
import { useRecentReports } from '@/features/reports/hooks/use-recent-reports'
import { useBenchmarkCandidates } from './use-benchmark-candidates'
import { useBenchmarkFormState, suggestTargetPercentile, type AutoBenchmarkFormConfig } from './use-benchmark-form-state'
import { useBossKillSelection } from './use-boss-kill-selection'
import { usePlayerAnalysisExportJob } from './use-player-analysis-export-job'
import { usePlayerAnalysisPreview } from './use-player-analysis-preview'
import { useRecentPlayers } from './use-recent-players'
import {
  buildBaselineKeysFromFightSelection,
  buildSelectedCandidates,
  countSelectedFights,
} from '../lib/player-analysis-utils'
import { scopeReducer, INITIAL_SCOPE_STATE } from './scope-reducer'
import type { AvailableBaseline } from '../types/available-baseline'
import type { PlayerAnalysisExportRequest, PlayerAnalysisExportView, PlayerAnalysisTimeframePreset } from '../types/player-analysis.types'
import { STABLE_EXPORT_VIEWS } from '../types/player-analysis.types'

export type PlayerAnalysisState = ReturnType<typeof usePlayerAnalysisState>

export const usePlayerAnalysisState = () => {
  // ── Data hooks ──────────────────────────────────────────────────────────────
  const recentPlayersQuery = useRecentPlayers()
  const recentReportsQuery = useRecentReports()
  const previewMutation = usePlayerAnalysisPreview()
  const exportJob = usePlayerAnalysisExportJob()
  const benchmarkCandidatesMutation = useBenchmarkCandidates()

  // ── UI state ────────────────────────────────────────────────────────────────
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [forcedStep, setForcedStep] = useState<number | null>(null)

  // ── Scope state ─────────────────────────────────────────────────────────────
  const [scope, dispatchScope] = useReducer(scopeReducer, INITIAL_SCOPE_STATE)
  const { playerName, timeframePreset, selectedReports, includeKills, includeWipes, includeTrash, onlyPlayerPresent } = scope
  const setPlayerName        = (value: string)                        => dispatchScope({ type: 'setPlayerName', value })
  const setTimeframePreset   = (value: PlayerAnalysisTimeframePreset) => dispatchScope({ type: 'setTimeframePreset', value })
  const setSelectedReports   = (value: string[])                      => dispatchScope({ type: 'setSelectedReports', value })
  const setIncludeKills      = (value: boolean)                       => dispatchScope({ type: 'setIncludeKills', value })
  const setIncludeWipes      = (value: boolean)                       => dispatchScope({ type: 'setIncludeWipes', value })
  const setIncludeTrash      = (value: boolean)                       => dispatchScope({ type: 'setIncludeTrash', value })
  const setOnlyPlayerPresent = (value: boolean)                       => dispatchScope({ type: 'setOnlyPlayerPresent', value })
  const [selectedViews, setSelectedViews] = useState<PlayerAnalysisExportView[]>([...STABLE_EXPORT_VIEWS])
  const [pendingClassName, setPendingClassName] = useState<string | null>(null)

  // ── Derived preview (must precede sub-hooks) ─────────────────────────────────
  const preview = previewMutation.data ?? null

  // ── Focused sub-hooks ────────────────────────────────────────────────────────
  const bossKillSelection = useBossKillSelection({ preview, onForcedStepClear: () => setForcedStep(null) })
  const benchmarkFormState = useBenchmarkFormState()

  // ── Sequencing guards ────────────────────────────────────────────────────────
  // previewRequestSeq prevents stale preview responses from overwriting newer state.
  // lastAutoPreviewedName prevents re-triggering a preview for the same player on autocomplete re-selection.
  const previewRequestSeq = useRef(0)
  const lastAutoPreviewedName = useRef<string>('')

  // ── Derived state ────────────────────────────────────────────────────────────
  const job = exportJob.jobStatus

  const wclClassName = preview?.detectedPlayer?.className !== 'unknown' ? preview?.detectedPlayer?.className ?? null : null
  const wclSpecName = preview?.detectedPlayer?.specName !== 'unknown' ? preview?.detectedPlayer?.specName ?? null : null
  const hasWclClassSpec = !!wclClassName && !!wclSpecName
  const hasUserClassSpec = !!benchmarkFormState.playerUserContext?.className && !!benchmarkFormState.playerUserContext?.specName
  const selectedUserSource = benchmarkFormState.benchmarkContextSource === 'userProvided'
  const effectiveClassName = selectedUserSource
    ? (hasUserClassSpec ? benchmarkFormState.playerUserContext?.className ?? null : null)
    : hasWclClassSpec ? wclClassName : hasUserClassSpec ? benchmarkFormState.playerUserContext?.className ?? null : null
  const effectiveSpecName = selectedUserSource
    ? (hasUserClassSpec ? benchmarkFormState.playerUserContext?.specName ?? null : null)
    : hasWclClassSpec ? wclSpecName : hasUserClassSpec ? benchmarkFormState.playerUserContext?.specName ?? null : null
  const specDetectionFailed = !!preview && (!wclClassName || !wclSpecName)

  const availableBaselines: AvailableBaseline[] = preview
    ? preview.includedReports
        .filter((r) => r.playerPresent)
        .flatMap((r) =>
          r.includedFights
            .filter((f) => {
              const selectedInScope = (bossKillSelection.selectedFightIdsByReport[r.code] ?? []).includes(f.fightId)
              return selectedInScope && (f.encounterId ?? 0) > 0 && f.playerPresent && f.durationMs >= 60000
            })
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
              specName: f.playerSpecName ?? effectiveSpecName ?? 'unknown',
              itemLevel: f.playerItemLevel ?? null,
              playerParse: f.playerParse ?? null,
            }))
        )
    : []

  const contextSource = hasWclClassSpec && benchmarkFormState.benchmarkContextSource !== 'userProvided'
    ? ('wclDetected' as const)
    : ('userProvided' as const)

  const selectedPlayerFightContext = (() => {
    if (!preview) return null
    const selectedKeys = new Set(
      Object.entries(bossKillSelection.selectedFightIdsByReport).flatMap(([code, ids]) => ids.map((id) => `${code}:${id}`))
    )
    if (selectedKeys.size !== 1) return null
    const key = [...selectedKeys][0]
    for (const r of preview.includedReports) {
      for (const f of r.includedFights) {
        if (`${r.code}:${f.fightId}` !== key) continue
        const itemLevel = f.playerItemLevel ?? null
        return {
          playerName: preview.detectedPlayer?.characterName ?? playerName,
          reportCode: r.code,
          fightId: f.fightId,
          encounterId: f.encounterId ?? 0,
          difficulty: f.difficulty,
          className: effectiveClassName ?? 'unknown',
          specName: f.playerSpecName ?? effectiveSpecName ?? 'unknown',
          itemLevel,
          itemLevelSource: itemLevel != null
            ? ('selectedFightCombatantInfo' as const)
            : ('unknown' as const),
          specSource: f.playerSpecName != null
            ? ('selectedFightCombatantInfo' as const)
            : effectiveSpecName != null
              ? ('detectedContext' as const)
              : ('unknown' as const),
          warnings: itemLevel == null ? ['Item level unavailable for selected fight — benchmark delta will not be shown'] : [],
        }
      }
    }
    return null
  })()

  const selectedAutoCandidates = buildSelectedCandidates(
    availableBaselines,
    benchmarkCandidatesMutation.data ?? null,
    bossKillSelection.selectedBaselineKeys,
    bossKillSelection.selectedCandidateKeysByBaseline
  )

  const selectedGroupCount = benchmarkCandidatesMutation.data?.groups.filter(
    (group) => bossKillSelection.selectedBaselineKeys.has(`${group.baseline.reportCode}:${group.baseline.fightId}`)
  ).length ?? 0

  const selectedExportableCount = benchmarkCandidatesMutation.data?.groups.filter((group) => {
    const baselineKey = `${group.baseline.reportCode}:${group.baseline.fightId}`
    if (!bossKillSelection.selectedBaselineKeys.has(baselineKey)) return false
    const selectedKey = bossKillSelection.selectedCandidateKeysByBaseline[baselineKey]
    const selectedCandidate = group.candidates.find((candidate) => {
      const reportCode = candidate.reportCode ?? ''
      const fightId = candidate.fightId ?? 0
      const player = candidate.characterName ?? ''
      return `${reportCode}:${fightId}:${player}` === selectedKey
    })
    return !!selectedCandidate?.validation.hasUsableExportTarget
  }).length ?? 0

  const benchmarkAutoGuardReason =
    benchmarkFormState.benchmarkMode === 'auto' && selectedAutoCandidates.length === 0
      ? bossKillSelection.selectedBaselineKeys.size === 0
        ? 'Auto benchmark is enabled, but no baseline fights are selected.'
        : selectedGroupCount === 0
          ? 'Auto benchmark is enabled, but no exportable candidates are selected yet. Find candidates first or switch to manual benchmark mode.'
          : selectedExportableCount === 0
            ? 'Auto benchmark is enabled, but none of the selected baseline fights has an exportable candidate. Switch to Manual log mode or adjust baseline/context and re-run candidate discovery.'
            : 'Auto benchmark is enabled, but no exportable benchmark candidates are selected.'
      : null

  const benchmarkManualGuardReason =
    benchmarkFormState.benchmarkMode === 'manual' && benchmarkFormState.manualMissingFields.length > 0
      ? `Manual benchmark is enabled, but missing ${benchmarkFormState.manualMissingFields.join(', ')}.`
      : null

  const benchmarkBlockedReason = benchmarkAutoGuardReason ?? benchmarkManualGuardReason
  const canUseSubjectOnlyOverride = benchmarkFormState.benchmarkMode !== 'none' && !!benchmarkBlockedReason
  const exportBlockedReason = benchmarkBlockedReason && !benchmarkFormState.allowSubjectOnlyWithoutBenchmark ? benchmarkBlockedReason : null
  const canFindCandidates = !!preview && bossKillSelection.selectedBaselineKeys.size > 0 && !!preview.detectedPlayer && !!effectiveClassName && !!effectiveSpecName

  const showProgress = exportJob.isStarting || job !== null
  const showResults = !!job && (job.status === 'complete' || job.status === 'partial' || (job.status === 'failed' && (job.files?.length ?? 0) > 0))

  const players = [...(recentPlayersQuery.data?.players ?? [])].sort((left, right) => {
    const reportDelta = (right.seenInRaidKillReports ?? 0) - (left.seenInRaidKillReports ?? 0)
    if (reportDelta !== 0) return reportDelta
    const fightDelta = (right.seenInRaidKillFights ?? 0) - (left.seenInRaidKillFights ?? 0)
    if (fightDelta !== 0) return fightDelta
    const seenDelta = (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0)
    if (seenDelta !== 0) return seenDelta
    return left.name.localeCompare(right.name)
  })

  const reports = recentReportsQuery.data?.reports ?? []
  const firstBaseline = availableBaselines[0] ?? null

  const hasStartedPreview = previewMutation.isPending || previewMutation.isSuccess || !!previewMutation.error
  const derivedActiveStep =
    !hasStartedPreview ? 0 :
    !preview || bossKillSelection.selectedFightCount === 0 ? 1 :
    benchmarkFormState.benchmarkMode === 'auto' && selectedAutoCandidates.length === 0 && !benchmarkFormState.allowSubjectOnlyWithoutBenchmark ? 2 :
    3
  const activeStep = forcedStep ?? derivedActiveStep

  // ── Actions ─────────────────────────────────────────────────────────────────

  const invalidatePreviewState = (params?: { resetUserContext?: boolean }) => {
    previewRequestSeq.current += 1
    previewMutation.reset()
    bossKillSelection.setSelectedFightIdsByReport({})
    bossKillSelection.syncSelectedBaselineKeys(new Set())
    benchmarkCandidatesMutation.reset()
    if (params?.resetUserContext) {
      benchmarkFormState.setPlayerUserContext(null)
      benchmarkFormState.setBenchmarkContextSource('wclDetected')
    }
  }

  const buildRequest = (params?: { forExport?: boolean; playerNameOverride?: string }): PlayerAnalysisExportRequest => ({
    playerName: params?.playerNameOverride ?? playerName,
    timeframePreset,
    reportCodes: timeframePreset === 'manualReports' ? selectedReports : undefined,
    fightIdsByReport: params?.forExport ? bossKillSelection.selectedFightIdsByReport : undefined,
    includeKills,
    includeWipes,
    includeTrash,
    onlyPlayerPresent,
    views: selectedViews,
    playerContext: benchmarkFormState.playerUserContext
      ? { className: benchmarkFormState.playerUserContext.className || undefined, specName: benchmarkFormState.playerUserContext.specName || undefined, role: benchmarkFormState.playerUserContext.specName ? benchmarkFormState.playerUserContext.role : undefined, source: 'userProvided' as const }
      : undefined,
    benchmarkContextSource: benchmarkFormState.benchmarkContextSource,
    ...(benchmarkFormState.benchmarkMode !== 'none'
      ? {
          benchmark: {
            requested: true as const,
            mode: benchmarkFormState.benchmarkMode,
            targetPercentile: benchmarkFormState.benchmarkMode === 'auto' ? benchmarkFormState.autoBenchmarkConfig.targetPercentile : undefined,
            metric: benchmarkFormState.benchmarkMode === 'auto' ? benchmarkFormState.autoBenchmarkConfig.metric : undefined,
            allowSubjectOnlyWithoutBenchmark: benchmarkBlockedReason && benchmarkFormState.allowSubjectOnlyWithoutBenchmark ? true : undefined,
            ...(benchmarkFormState.benchmarkMode === 'manual' && benchmarkFormState.manualBenchmarkConfig.reportCode.trim() && benchmarkFormState.manualBenchmarkConfig.fightId.trim() && benchmarkFormState.manualBenchmarkConfig.playerName.trim()
              ? { manualTarget: { reportCode: benchmarkFormState.manualBenchmarkConfig.reportCode.trim(), fightId: Number(benchmarkFormState.manualBenchmarkConfig.fightId), playerName: benchmarkFormState.manualBenchmarkConfig.playerName.trim() } }
              : {}),
            ...(benchmarkFormState.benchmarkMode === 'auto' ? { selectedCandidates: buildSelectedCandidates(availableBaselines, benchmarkCandidatesMutation.data ?? null, bossKillSelection.selectedBaselineKeys, bossKillSelection.selectedCandidateKeysByBaseline) } : {}),
          },
        }
      : {}),
  })

  const handleFindCandidatesWithKeys = (keysOverride: Set<string>, baselinesOverride?: AvailableBaseline[], targetPercentileOverride?: AutoBenchmarkFormConfig['targetPercentile']) => {
    if (!preview || keysOverride.size === 0 || !preview.detectedPlayer) return
    const baselinesSource = baselinesOverride ?? availableBaselines
    const baselines = baselinesSource
      .filter((b) => keysOverride.has(b.key))
      .map((b) => ({ reportCode: b.reportCode, fightId: b.fightId, encounterId: b.encounterId, encounterName: b.encounterName, difficulty: b.difficulty, durationMs: b.durationMs, playerName: b.playerName, className: b.className, specName: b.specName, itemLevel: b.itemLevel, contextSource }))
    if (baselines.length === 0) return
    const targetPercentile = targetPercentileOverride ?? benchmarkFormState.autoBenchmarkConfig.targetPercentile
    benchmarkCandidatesMutation.mutate(
      { baselines, targetPercentile, metric: benchmarkFormState.autoBenchmarkConfig.metric, itemLevelWindow: benchmarkFormState.autoBenchmarkConfig.itemLevelWindow, durationWindowPercent: benchmarkFormState.autoBenchmarkConfig.durationWindowPercent, maxCandidatesPerFight: 10, benchmarkContextSource: benchmarkFormState.benchmarkContextSource, playerContext: benchmarkFormState.playerUserContext ? { ...benchmarkFormState.playerUserContext, role: benchmarkFormState.playerUserContext.role, source: 'userProvided' as const } : undefined },
    )
  }

  const handleTargetTierChange = (tier: AutoBenchmarkFormConfig['targetPercentile']) => {
    benchmarkFormState.setAutoBenchmarkConfig((prev) => ({ ...prev, targetPercentile: tier }))
    handleFindCandidatesWithKeys(bossKillSelection.selectedBaselineKeys, undefined, tier)
  }

  const handlePreview = (playerNameOverride?: string) => {
    bossKillSelection.syncSelectedBaselineKeys(new Set())
    const requestId = previewRequestSeq.current + 1
    previewRequestSeq.current = requestId
    previewMutation.mutate(buildRequest({ playerNameOverride }), {
      onSuccess: (data) => {
        if (requestId !== previewRequestSeq.current) return
        const emptySelection = Object.fromEntries(
          (data.includedReports ?? []).map((r) => [r.code, [] as number[]])
        )
        bossKillSelection.setSelectedFightIdsByReport(emptySelection)
        if (benchmarkFormState.benchmarkContextSource === 'wclDetected' && data.effectiveContext?.source === 'userProvided') {
          benchmarkFormState.setBenchmarkContextSource('userProvided')
        }
      },
    })
  }

  const handleGenerateExport = async () => {
    if (selectedViews.length === 0 || countSelectedFights(bossKillSelection.selectedFightIdsByReport) === 0) return
    if (exportBlockedReason) return
    await exportJob.startExport(buildRequest({ forExport: true }))
  }

  const handleFindCandidates = () => {
    if (!preview || bossKillSelection.selectedBaselineKeys.size === 0 || !preview.detectedPlayer) return
    handleFindCandidatesWithKeys(bossKillSelection.selectedBaselineKeys)
  }

  const handleScopeFieldChange = (applyChange: () => void, options?: { resetUserContext?: boolean }) => {
    applyChange()
    invalidatePreviewState(options)
  }

  const handleSelectBossKill = (reportCode: string, fightId: number) => {
    if (!preview) return
    const nextSelection: Record<string, number[]> = Object.fromEntries(
      (preview.includedReports ?? []).map((report) => [report.code, report.code === reportCode ? [fightId] : []])
    )
    bossKillSelection.setSelectedFightIdsByReport(nextSelection)
    const nextBaselineKeys = buildBaselineKeysFromFightSelection(preview, nextSelection)
    bossKillSelection.syncSelectedBaselineKeys(nextBaselineKeys)
    setForcedStep(null)

    if (nextBaselineKeys.size === 0 || !effectiveClassName || !effectiveSpecName) return
    const baselinesForAutoTrigger: AvailableBaseline[] = (preview.includedReports ?? [])
      .filter((r) => r.playerPresent)
      .flatMap((r) =>
        (r.includedFights ?? [])
          .filter((f) => nextBaselineKeys.has(`${r.code}:${f.fightId}`))
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
            className: effectiveClassName,
            specName: effectiveSpecName,
            itemLevel: f.playerItemLevel ?? null,
            playerParse: f.playerParse ?? null,
          }))
      )

    const selectedFight = baselinesForAutoTrigger[0]
    const smartTarget = suggestTargetPercentile(selectedFight?.playerParse ?? null)
    benchmarkFormState.setAutoBenchmarkConfig((prev) => ({ ...prev, targetPercentile: smartTarget }))

    handleFindCandidatesWithKeys(nextBaselineKeys, baselinesForAutoTrigger)
  }

  const handlePlayerSelect = (player: { name: string; className?: string | null }) => {
    const name = player.name.trim()
    if (!name || name.toLowerCase() === lastAutoPreviewedName.current) return
    setPendingClassName(player.className ?? null)
    handleScopeFieldChange(() => setPlayerName(name), { resetUserContext: true })
    lastAutoPreviewedName.current = name.toLowerCase()
    setForcedStep(null)
    handlePreview(name)
  }

  return {
    // Queries
    previewMutation,
    exportJob,
    benchmarkCandidatesMutation,
    recentPlayersQuery,
    recentReportsQuery,
    // Derived from queries
    preview,
    job,
    players,
    reports,
    // Scope state
    playerName,
    setPlayerName,
    timeframePreset,
    setTimeframePreset,
    selectedReports,
    setSelectedReports,
    includeKills,
    setIncludeKills,
    includeWipes,
    setIncludeWipes,
    includeTrash,
    setIncludeTrash,
    onlyPlayerPresent,
    setOnlyPlayerPresent,
    selectedViews,
    setSelectedViews,
    // Boss kill selection state (from sub-hook — internal wiring not exposed)
    selectedFightIdsByReport: bossKillSelection.selectedFightIdsByReport,
    selectedBaselineKeys: bossKillSelection.selectedBaselineKeys,
    selectedCandidateKeysByBaseline: bossKillSelection.selectedCandidateKeysByBaseline,
    selectedFightCount: bossKillSelection.selectedFightCount,
    isSelected: bossKillSelection.isSelected,
    handleFightSelectionChange: bossKillSelection.handleFightSelectionChange,
    handleSelectAllEligibleFights: bossKillSelection.handleSelectAllEligibleFights,
    handleClearFightSelection: bossKillSelection.handleClearFightSelection,
    handleBaselineSelectionChange: bossKillSelection.handleBaselineSelectionChange,
    handleBenchmarkCandidateSelection: bossKillSelection.handleBenchmarkCandidateSelection,
    // Benchmark form state (from sub-hook)
    benchmarkMode: benchmarkFormState.benchmarkMode,
    setBenchmarkMode: benchmarkFormState.setBenchmarkMode,
    manualBenchmarkConfig: benchmarkFormState.manualBenchmarkConfig,
    setManualBenchmarkConfig: benchmarkFormState.setManualBenchmarkConfig,
    autoBenchmarkConfig: benchmarkFormState.autoBenchmarkConfig,
    setAutoBenchmarkConfig: benchmarkFormState.setAutoBenchmarkConfig,
    allowSubjectOnlyWithoutBenchmark: benchmarkFormState.allowSubjectOnlyWithoutBenchmark,
    setAllowSubjectOnlyWithoutBenchmark: benchmarkFormState.setAllowSubjectOnlyWithoutBenchmark,
    playerUserContext: benchmarkFormState.playerUserContext,
    setPlayerUserContext: benchmarkFormState.setPlayerUserContext,
    benchmarkContextSource: benchmarkFormState.benchmarkContextSource,
    setBenchmarkContextSource: benchmarkFormState.setBenchmarkContextSource,
    // UI state
    sidebarOpen,
    setSidebarOpen,
    forcedStep,
    setForcedStep,
    // Derived state
    effectiveClassName,
    pendingClassName,
    effectiveSpecName,
    specDetectionFailed,
    availableBaselines,
    selectedPlayerFightContext,
    selectedAutoCandidates,
    canFindCandidates,
    benchmarkBlockedReason,
    canUseSubjectOnlyOverride,
    exportBlockedReason,
    selectedGroupCount,
    selectedExportableCount,
    showProgress,
    showResults,
    firstBaseline,
    activeStep,
    // Helpers
    // Action handlers
    handlePreview,
    handleGenerateExport,
    handleFindCandidates,
    handleTargetTierChange,
    handleScopeFieldChange,
    handleSelectBossKill,
    handlePlayerSelect,
    resetLastPreviewedName: () => { lastAutoPreviewedName.current = '' },
  }
}
