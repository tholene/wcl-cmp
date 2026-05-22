import { useRef, useState } from 'react'
import { useRecentReports } from '@/features/reports/hooks/use-recent-reports'
import { useBenchmarkCandidates } from './use-benchmark-candidates'
import { usePlayerAnalysisExportJob } from './use-player-analysis-export-job'
import { usePlayerAnalysisPreview } from './use-player-analysis-preview'
import { useRecentPlayers } from './use-recent-players'
import {
  buildAllEligibleFightSelection,
  buildBaselineKeysFromFightSelection,
  buildSelectedCandidates,
  countSelectedFights,
} from '../lib/player-analysis-utils'
import type { AvailableBaseline } from '../types/available-baseline'
import type { ClassSpecOverride } from '../types/class-spec-override'
import {
  STABLE_EXPORT_VIEWS,
  type PlayerAnalysisExportRequest,
  type PlayerAnalysisExportView,
  type PlayerAnalysisTimeframePreset,
} from '../types/player-analysis.types'

// Form-state shapes — fightId is string because it comes from a text input
type ManualBenchmarkFormConfig = {
  reportCode: string
  fightId: string
  playerName: string
}

type AutoBenchmarkFormConfig = {
  targetPercentile: 50 | 75 | 90
  metric: string
  itemLevelWindow: number
  durationWindowPercent: number
}

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
  const [playerName, setPlayerName] = useState('')
  const [timeframePreset, setTimeframePreset] = useState<PlayerAnalysisTimeframePreset>('last30Days')
  const [selectedReports, setSelectedReports] = useState<string[]>([])
  const [includeKills, setIncludeKills] = useState(true)
  const [includeWipes, setIncludeWipes] = useState(false)
  const [includeTrash, setIncludeTrash] = useState(false)
  const [onlyPlayerPresent, setOnlyPlayerPresent] = useState(true)
  const [selectedViews, setSelectedViews] = useState<PlayerAnalysisExportView[]>([...STABLE_EXPORT_VIEWS])
  const [selectedFightIdsByReport, setSelectedFightIdsByReport] = useState<Record<string, number[]>>({})

  // ── Benchmark state ─────────────────────────────────────────────────────────
  const [benchmarkMode, setBenchmarkMode] = useState<'none' | 'manual' | 'auto'>('auto')
  const [manualBenchmarkConfig, setManualBenchmarkConfig] = useState<ManualBenchmarkFormConfig>({
    reportCode: '', fightId: '', playerName: '',
  })
  const [autoBenchmarkConfig, setAutoBenchmarkConfig] = useState<AutoBenchmarkFormConfig>({
    targetPercentile: 75, metric: 'dps', itemLevelWindow: 10, durationWindowPercent: 35,
  })
  const [allowSubjectOnlyWithoutBenchmark, setAllowSubjectOnlyWithoutBenchmark] = useState(false)
  const [selectedBaselineKeys, setSelectedBaselineKeys] = useState<Set<string>>(new Set())
  const [selectedCandidateKeysByBaseline, setSelectedCandidateKeysByBaseline] = useState<Record<string, string>>({})
  const [playerUserContext, setPlayerUserContext] = useState<ClassSpecOverride | null>(null)
  const [benchmarkContextSource, setBenchmarkContextSource] = useState<'wclDetected' | 'userProvided'>('wclDetected')

  // ── Sequencing guards ────────────────────────────────────────────────────────
  // previewRequestSeq prevents stale preview responses from overwriting newer state.
  // lastAutoPreviewedName prevents re-triggering a preview for the same player on autocomplete re-selection.
  const previewRequestSeq = useRef(0)
  const lastAutoPreviewedName = useRef<string>('')

  // ── Derived state ────────────────────────────────────────────────────────────
  const preview = previewMutation.data ?? null
  const job = exportJob.jobStatus

  const wclClassName = preview?.detectedPlayer?.className !== 'unknown' ? preview?.detectedPlayer?.className ?? null : null
  const wclSpecName = preview?.detectedPlayer?.specName !== 'unknown' ? preview?.detectedPlayer?.specName ?? null : null
  const hasWclClassSpec = !!wclClassName && !!wclSpecName
  const hasUserClassSpec = !!playerUserContext?.className && !!playerUserContext?.specName
  const selectedUserSource = benchmarkContextSource === 'userProvided'
  const effectiveClassName = selectedUserSource
    ? (hasUserClassSpec ? playerUserContext?.className ?? null : null)
    : hasWclClassSpec ? wclClassName : hasUserClassSpec ? playerUserContext?.className ?? null : null
  const effectiveSpecName = selectedUserSource
    ? (hasUserClassSpec ? playerUserContext?.specName ?? null : null)
    : hasWclClassSpec ? wclSpecName : hasUserClassSpec ? playerUserContext?.specName ?? null : null
  const specDetectionFailed = !!preview && (!wclClassName || !wclSpecName)

  const availableBaselines: AvailableBaseline[] = preview
    ? preview.includedReports
        .filter((r) => r.playerPresent)
        .flatMap((r) =>
          r.includedFights
            .filter((f) => {
              const selectedInScope = (selectedFightIdsByReport[r.code] ?? []).includes(f.fightId)
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
            }))
        )
    : []

  const contextSource = hasWclClassSpec && benchmarkContextSource !== 'userProvided'
    ? ('wclDetected' as const)
    : ('userProvided' as const)

  const selectedPlayerFightContext = (() => {
    if (!preview) return null
    const selectedKeys = new Set(
      Object.entries(selectedFightIdsByReport).flatMap(([code, ids]) => ids.map((id) => `${code}:${id}`))
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
    selectedBaselineKeys,
    selectedCandidateKeysByBaseline
  )

  const selectedGroupCount = benchmarkCandidatesMutation.data?.groups.filter(
    (group) => selectedBaselineKeys.has(`${group.baseline.reportCode}:${group.baseline.fightId}`)
  ).length ?? 0

  const selectedExportableCount = benchmarkCandidatesMutation.data?.groups.filter((group) => {
    const baselineKey = `${group.baseline.reportCode}:${group.baseline.fightId}`
    if (!selectedBaselineKeys.has(baselineKey)) return false
    const selectedKey = selectedCandidateKeysByBaseline[baselineKey]
    const selectedCandidate = group.candidates.find((candidate) => {
      const reportCode = candidate.reportCode ?? ''
      const fightId = candidate.fightId ?? 0
      const player = candidate.characterName ?? ''
      return `${reportCode}:${fightId}:${player}` === selectedKey
    })
    return !!selectedCandidate?.validation.hasUsableExportTarget
  }).length ?? 0

  const manualMissingFields: string[] = []
  if (benchmarkMode === 'manual') {
    if (!manualBenchmarkConfig.reportCode.trim()) manualMissingFields.push('report code')
    if (!manualBenchmarkConfig.fightId.trim()) manualMissingFields.push('fight ID')
    if (!manualBenchmarkConfig.playerName.trim()) manualMissingFields.push('player name')
  }

  const benchmarkAutoGuardReason =
    benchmarkMode === 'auto' && selectedAutoCandidates.length === 0
      ? selectedBaselineKeys.size === 0
        ? 'Auto benchmark is enabled, but no baseline fights are selected.'
        : selectedGroupCount === 0
          ? 'Auto benchmark is enabled, but no exportable candidates are selected yet. Find candidates first or switch to manual benchmark mode.'
          : selectedExportableCount === 0
            ? 'Auto benchmark is enabled, but none of the selected baseline fights has an exportable candidate. Switch to Manual log mode or adjust baseline/context and re-run candidate discovery.'
            : 'Auto benchmark is enabled, but no exportable benchmark candidates are selected.'
      : null

  const benchmarkManualGuardReason =
    benchmarkMode === 'manual' && manualMissingFields.length > 0
      ? `Manual benchmark is enabled, but missing ${manualMissingFields.join(', ')}.`
      : null

  const benchmarkBlockedReason = benchmarkAutoGuardReason ?? benchmarkManualGuardReason
  const canUseSubjectOnlyOverride = benchmarkMode !== 'none' && !!benchmarkBlockedReason
  const exportBlockedReason = benchmarkBlockedReason && !allowSubjectOnlyWithoutBenchmark ? benchmarkBlockedReason : null
  const canFindCandidates = !!preview && selectedBaselineKeys.size > 0 && !!preview.detectedPlayer && !!effectiveClassName && !!effectiveSpecName

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
  const selectedFightCount = countSelectedFights(selectedFightIdsByReport)
  const firstBaseline = availableBaselines[0] ?? null

  const hasStartedPreview = previewMutation.isPending || previewMutation.isSuccess || !!previewMutation.error
  const derivedActiveStep =
    !hasStartedPreview ? 0 :
    !preview || selectedFightCount === 0 ? 1 :
    benchmarkMode === 'auto' && selectedAutoCandidates.length === 0 && !allowSubjectOnlyWithoutBenchmark ? 2 :
    3
  const activeStep = forcedStep ?? derivedActiveStep

  // ── Actions ─────────────────────────────────────────────────────────────────

  const syncSelectedBaselineKeys = (nextKeys: Set<string>) => {
    setSelectedBaselineKeys(nextKeys)
    setSelectedCandidateKeysByBaseline((current) => {
      const filtered: Record<string, string> = {}
      for (const baselineKey of Object.keys(current)) {
        if (nextKeys.has(baselineKey)) filtered[baselineKey] = current[baselineKey]
      }
      return filtered
    })
  }

  const invalidatePreviewState = (params?: { resetUserContext?: boolean }) => {
    previewRequestSeq.current += 1
    previewMutation.reset()
    setSelectedFightIdsByReport({})
    syncSelectedBaselineKeys(new Set())
    benchmarkCandidatesMutation.reset()
    if (params?.resetUserContext) {
      setPlayerUserContext(null)
      setBenchmarkContextSource('wclDetected')
    }
  }

  const buildRequest = (params?: { forExport?: boolean; playerNameOverride?: string }): PlayerAnalysisExportRequest => ({
    playerName: params?.playerNameOverride ?? playerName,
    timeframePreset,
    reportCodes: timeframePreset === 'manualReports' ? selectedReports : undefined,
    fightIdsByReport: params?.forExport ? selectedFightIdsByReport : undefined,
    includeKills,
    includeWipes,
    includeTrash,
    onlyPlayerPresent,
    views: selectedViews,
    playerContext: playerUserContext
      ? { className: playerUserContext.className || undefined, specName: playerUserContext.specName || undefined, role: playerUserContext.specName ? playerUserContext.role : undefined, source: 'userProvided' as const }
      : undefined,
    benchmarkContextSource,
    ...(benchmarkMode !== 'none'
      ? {
          benchmark: {
            requested: true as const,
            mode: benchmarkMode,
            targetPercentile: benchmarkMode === 'auto' ? autoBenchmarkConfig.targetPercentile : undefined,
            metric: benchmarkMode === 'auto' ? autoBenchmarkConfig.metric : undefined,
            allowSubjectOnlyWithoutBenchmark: benchmarkBlockedReason && allowSubjectOnlyWithoutBenchmark ? true : undefined,
            ...(benchmarkMode === 'manual' && manualBenchmarkConfig.reportCode.trim() && manualBenchmarkConfig.fightId.trim() && manualBenchmarkConfig.playerName.trim()
              ? { manualTarget: { reportCode: manualBenchmarkConfig.reportCode.trim(), fightId: Number(manualBenchmarkConfig.fightId), playerName: manualBenchmarkConfig.playerName.trim() } }
              : {}),
            ...(benchmarkMode === 'auto' ? { selectedCandidates: buildSelectedCandidates(availableBaselines, benchmarkCandidatesMutation.data ?? null, selectedBaselineKeys, selectedCandidateKeysByBaseline) } : {}),
          },
        }
      : {}),
  })

  const handleFindCandidatesWithKeys = (keysOverride: Set<string>, baselinesOverride?: AvailableBaseline[]) => {
    if (!preview || keysOverride.size === 0 || !preview.detectedPlayer) return
    const baselinesSource = baselinesOverride ?? availableBaselines
    const baselines = baselinesSource
      .filter((b) => keysOverride.has(b.key))
      .map((b) => ({ reportCode: b.reportCode, fightId: b.fightId, encounterId: b.encounterId, encounterName: b.encounterName, difficulty: b.difficulty, durationMs: b.durationMs, playerName: b.playerName, className: b.className, specName: b.specName, itemLevel: b.itemLevel, contextSource }))
    if (baselines.length === 0) return
    benchmarkCandidatesMutation.mutate(
      { baselines, targetPercentile: autoBenchmarkConfig.targetPercentile, metric: autoBenchmarkConfig.metric, itemLevelWindow: autoBenchmarkConfig.itemLevelWindow, durationWindowPercent: autoBenchmarkConfig.durationWindowPercent, maxCandidatesPerFight: 10, benchmarkContextSource, playerContext: playerUserContext ? { ...playerUserContext, role: playerUserContext.role, source: 'userProvided' as const } : undefined },
      {
        onSuccess: (data) => {
          const nextSelections: Record<string, string> = {}
          for (const group of data.groups ?? []) {
            const baselineKey = `${group.baseline.reportCode}:${group.baseline.fightId}`
            const recommended = group.selectedCandidate
            if (recommended?.validation.hasUsableExportTarget && recommended.reportCode && typeof recommended.fightId === 'number') {
              nextSelections[baselineKey] = `${recommended.reportCode}:${recommended.fightId}:${recommended.characterName}`
            }
          }
          setSelectedCandidateKeysByBaseline(nextSelections)
        },
      }
    )
  }

  const handlePreview = (playerNameOverride?: string) => {
    syncSelectedBaselineKeys(new Set())
    const requestId = previewRequestSeq.current + 1
    previewRequestSeq.current = requestId
    previewMutation.mutate(buildRequest({ playerNameOverride }), {
      onSuccess: (data) => {
        if (requestId !== previewRequestSeq.current) return
        const emptySelection = Object.fromEntries(
          (data.includedReports ?? []).map((r) => [r.code, [] as number[]])
        )
        setSelectedFightIdsByReport(emptySelection)
        if (benchmarkContextSource === 'wclDetected' && data.effectiveContext?.source === 'userProvided') {
          setBenchmarkContextSource('userProvided')
        }
      },
    })
  }

  const handleGenerateExport = async () => {
    if (selectedViews.length === 0 || countSelectedFights(selectedFightIdsByReport) === 0) return
    if (exportBlockedReason) return
    await exportJob.startExport(buildRequest({ forExport: true }))
  }

  const handleFindCandidates = () => {
    if (!preview || selectedBaselineKeys.size === 0 || !preview.detectedPlayer) return
    handleFindCandidatesWithKeys(selectedBaselineKeys)
  }

  const handleScopeFieldChange = (applyChange: () => void, options?: { resetUserContext?: boolean }) => {
    applyChange()
    invalidatePreviewState(options)
  }

  const handleFightSelectionChange = (reportCode: string, fightId: number, selected: boolean) => {
    setSelectedFightIdsByReport((current) => {
      const existing = current[reportCode] ?? []
      const next = selected
        ? (existing.includes(fightId) ? existing : [...existing, fightId])
        : existing.filter((id) => id !== fightId)
      const nextSelection = { ...current, [reportCode]: next }
      if (preview) syncSelectedBaselineKeys(buildBaselineKeysFromFightSelection(preview, nextSelection))
      return nextSelection
    })
  }

  const handleBaselineSelectionChange = (next: Set<string>) => {
    syncSelectedBaselineKeys(next)
  }

  const handleBenchmarkCandidateSelection = (baselineKey: string, candidateKey: string) => {
    setSelectedCandidateKeysByBaseline((current) => ({ ...current, [baselineKey]: candidateKey }))
    setForcedStep(null)
  }

  const handleSelectAllEligibleFights = () => {
    if (!preview) return
    const nextSelection = buildAllEligibleFightSelection(preview)
    setSelectedFightIdsByReport(nextSelection)
    syncSelectedBaselineKeys(buildBaselineKeysFromFightSelection(preview, nextSelection))
  }

  const handleSelectBossKill = (reportCode: string, fightId: number) => {
    if (!preview) return
    const nextSelection: Record<string, number[]> = Object.fromEntries(
      (preview.includedReports ?? []).map((report) => [report.code, report.code === reportCode ? [fightId] : []])
    )
    setSelectedFightIdsByReport(nextSelection)
    const nextBaselineKeys = buildBaselineKeysFromFightSelection(preview, nextSelection)
    syncSelectedBaselineKeys(nextBaselineKeys)
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
          }))
      )
    handleFindCandidatesWithKeys(nextBaselineKeys, baselinesForAutoTrigger)
  }

  const handleClearFightSelection = () => {
    if (!preview) return
    const empty: Record<string, number[]> = {}
    for (const report of preview.includedReports ?? []) empty[report.code] = []
    setSelectedFightIdsByReport(empty)
    syncSelectedBaselineKeys(new Set())
  }

  const handlePlayerSelect = (player: { name: string }) => {
    const name = player.name.trim()
    if (!name || name.toLowerCase() === lastAutoPreviewedName.current) return
    handleScopeFieldChange(() => setPlayerName(name), { resetUserContext: true })
    lastAutoPreviewedName.current = name.toLowerCase()
    setForcedStep(null)
    handlePreview(name)
  }

  const isSelected = (reportCode: string, fightId: number): boolean =>
    (selectedFightIdsByReport[reportCode] ?? []).includes(fightId)

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
    selectedFightIdsByReport,
    // Benchmark state
    benchmarkMode,
    setBenchmarkMode,
    manualBenchmarkConfig,
    setManualBenchmarkConfig,
    autoBenchmarkConfig,
    setAutoBenchmarkConfig,
    allowSubjectOnlyWithoutBenchmark,
    setAllowSubjectOnlyWithoutBenchmark,
    selectedBaselineKeys,
    selectedCandidateKeysByBaseline,
    playerUserContext,
    setPlayerUserContext,
    benchmarkContextSource,
    setBenchmarkContextSource,
    // UI state
    sidebarOpen,
    setSidebarOpen,
    forcedStep,
    setForcedStep,
    // Derived state
    effectiveClassName,
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
    selectedFightCount,
    firstBaseline,
    activeStep,
    // Helpers
    isSelected,
    // Action handlers
    handlePreview,
    handleGenerateExport,
    handleFindCandidates,
    handleScopeFieldChange,
    handleFightSelectionChange,
    handleBaselineSelectionChange,
    handleBenchmarkCandidateSelection,
    handleSelectAllEligibleFights,
    handleSelectBossKill,
    handleClearFightSelection,
    handlePlayerSelect,
    resetLastPreviewedName: () => { lastAutoPreviewedName.current = '' },
  }
}
