import { useReducer, useRef, useState } from 'react'
import { useRecentReports } from '@/features/reports/hooks/use-recent-reports'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import { useBenchmarkCandidates } from './use-benchmark-candidates'
import { useBenchmarkFormState, suggestTargetPercentile, type AutoBenchmarkFormConfig } from './use-benchmark-form-state'
import { useBossKillSelection } from './use-boss-kill-selection'
import { useGlobalCharacterBossKills } from './use-global-character-boss-kills'
import { usePlayerAnalysisExportJob } from './use-player-analysis-export-job'
import { usePlayerAnalysisPreview } from './use-player-analysis-preview'
import { useRecentPlayers } from './use-recent-players'
import { getRoleForSpec } from '../types/wow-class-spec'
import { buildGlobalBossKillsRequest, getDefaultPlayerLookupMode, hasConfiguredGuildId } from '../lib/player-lookup-mode'
import { getGlobalBenchmarkBlockedReason } from '../lib/global-mode'
import {
  buildBaselineKeysFromFightSelection,
  buildSelectedCandidates,
  countSelectedFights,
} from '../lib/player-analysis-utils'
import { scopeReducer, INITIAL_SCOPE_STATE } from './scope-reducer'
import type { AvailableBaseline } from '../types/available-baseline'
import type {
  GlobalCharacterBossKill,
  GlobalCharacterLookupInput,
  PlayerAnalysisExportRequest,
  PlayerAnalysisExportView,
  PlayerAnalysisTimeframePreset,
} from '../types/player-analysis.types'
import { STABLE_EXPORT_VIEWS } from '../types/player-analysis.types'

export type PlayerAnalysisState = ReturnType<typeof usePlayerAnalysisState>

export const usePlayerAnalysisState = (context: AppSettingsRequestContext) => {
  const hasGuildId = hasConfiguredGuildId({ guildId: context.guildId })
  const [lookupMode, setLookupMode] = useState(() => getDefaultPlayerLookupMode({ guildId: context.guildId }))

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const recentPlayersQuery = useRecentPlayers(context, lookupMode === 'guild' && hasGuildId)
  const recentReportsQuery = useRecentReports(context, lookupMode === 'guild' && hasGuildId)
  const previewMutation = usePlayerAnalysisPreview(context)
  const globalBossKillsMutation = useGlobalCharacterBossKills()
  const exportJob = usePlayerAnalysisExportJob(context)
  const benchmarkCandidatesMutation = useBenchmarkCandidates(context)

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
  const [globalLookupInput, setGlobalLookupInputState] = useState<GlobalCharacterLookupInput>({
    characterUrl: '',
    region: context.region ?? '',
    realmSlug: '',
    characterName: '',
    includeWipes: false,
    limit: 10,
  })
  const [globalLookupValidationError, setGlobalLookupValidationError] = useState<string | null>(null)
  const [selectedGlobalBossKill, setSelectedGlobalBossKill] = useState<GlobalCharacterBossKill | null>(null)

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
  const globalResult = globalBossKillsMutation.data ?? null
  const globalBossKills = globalResult?.status === 'ok' ? globalResult.bossKills : []
  const globalBossKillByKey = new Map<string, GlobalCharacterBossKill>(
    globalBossKills.map((fight) => [`${fight.reportCode}:${fight.fightId}`, fight])
  )
  const hasGlobalLookupAttempt =
    globalBossKillsMutation.isPending ||
    globalBossKillsMutation.isSuccess ||
    !!globalBossKillsMutation.error ||
    !!globalLookupValidationError
  const hasGlobalSelection =
    lookupMode === 'global' &&
    Object.values(bossKillSelection.selectedFightIdsByReport).some((fightIds) => fightIds.length > 0)

  const wclClassName = preview?.detectedPlayer?.className !== 'unknown' ? preview?.detectedPlayer?.className ?? null : null
  const wclSpecName = preview?.detectedPlayer?.specName !== 'unknown' ? preview?.detectedPlayer?.specName ?? null : null
  const hasWclClassSpec = !!wclClassName && !!wclSpecName
  const hasUserClassSpec = !!benchmarkFormState.playerUserContext?.className && !!benchmarkFormState.playerUserContext?.specName
  const selectedUserSource = benchmarkFormState.benchmarkContextSource === 'userProvided'
  const selectedGlobalClassName =
    lookupMode === 'global' ? selectedGlobalBossKill?.className?.trim() || null : null
  const selectedGlobalSpecName =
    lookupMode === 'global' ? selectedGlobalBossKill?.specName?.trim() || null : null
  const hasGlobalClassSpec = !!selectedGlobalClassName && !!selectedGlobalSpecName
  const effectiveClassName = selectedUserSource
    ? (hasUserClassSpec ? benchmarkFormState.playerUserContext?.className ?? null : null)
    : hasGlobalClassSpec
      ? selectedGlobalClassName
      : hasWclClassSpec
        ? wclClassName
        : hasUserClassSpec
          ? benchmarkFormState.playerUserContext?.className ?? null
          : selectedGlobalClassName
  const effectiveSpecName = selectedUserSource
    ? (hasUserClassSpec ? benchmarkFormState.playerUserContext?.specName ?? null : null)
    : hasGlobalClassSpec
      ? selectedGlobalSpecName
      : hasWclClassSpec
        ? wclSpecName
        : hasUserClassSpec
          ? benchmarkFormState.playerUserContext?.specName ?? null
          : selectedGlobalSpecName
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
            .map((f): AvailableBaseline => {
              const key = `${r.code}:${f.fightId}`
              const globalFight = globalBossKillByKey.get(key)
              return {
                key,
              reportCode: r.code,
              reportTitle: r.title,
              fightId: f.fightId,
              encounterId: f.encounterId ?? 0,
              encounterName: f.encounterName,
              difficulty: f.difficulty,
              durationMs: f.durationMs,
              kill: f.kill,
              playerName: preview.detectedPlayer?.characterName ?? '',
              className: globalFight?.className ?? effectiveClassName ?? 'unknown',
              specName: f.playerSpecName ?? globalFight?.specName ?? effectiveSpecName ?? 'unknown',
              itemLevel: f.playerItemLevel ?? globalFight?.playerItemLevel ?? null,
              playerParse: f.playerParse ?? globalFight?.percentile ?? null,
            }})
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
        const globalFight = globalBossKillByKey.get(key)
        const itemLevel = f.playerItemLevel ?? globalFight?.playerItemLevel ?? null
        return {
          playerName: preview.detectedPlayer?.characterName ?? playerName,
          reportCode: r.code,
          fightId: f.fightId,
          encounterId: f.encounterId ?? 0,
          difficulty: f.difficulty,
          className: globalFight?.className ?? effectiveClassName ?? 'unknown',
          specName: f.playerSpecName ?? globalFight?.specName ?? effectiveSpecName ?? 'unknown',
          itemLevel,
          itemLevelSource: itemLevel != null
            ? ('selectedFightCombatantInfo' as const)
            : ('unknown' as const),
          specSource: f.playerSpecName != null
            ? ('selectedFightCombatantInfo' as const)
            : effectiveSpecName != null
              ? ('detectedContext' as const)
              : ('unknown' as const),
          warnings: [
            ...(itemLevel == null ? ['Item level unavailable for selected fight — benchmark delta will not be shown'] : []),
            ...(globalFight?.warnings ?? []),
          ],
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

  const globalBenchmarkBlockedReason = getGlobalBenchmarkBlockedReason({
    lookupMode,
    hasGlobalSelection,
    selectedGlobalBossKill,
  })
  const benchmarkBlockedReason = globalBenchmarkBlockedReason ?? benchmarkAutoGuardReason ?? benchmarkManualGuardReason
  const canUseSubjectOnlyOverride = benchmarkFormState.benchmarkMode !== 'none' && !!benchmarkBlockedReason
  const exportBlockedReason = benchmarkBlockedReason && !benchmarkFormState.allowSubjectOnlyWithoutBenchmark ? benchmarkBlockedReason : null
  const canFindCandidates =
    !!preview &&
    bossKillSelection.selectedBaselineKeys.size > 0 &&
    !!preview.detectedPlayer &&
    !!effectiveClassName &&
    !!effectiveSpecName &&
    !globalBenchmarkBlockedReason

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
  const hasStartedSelection = lookupMode === 'global' ? hasGlobalLookupAttempt || hasStartedPreview : hasStartedPreview
  const derivedActiveStep =
    !hasStartedSelection ? 0 :
    !preview || bossKillSelection.selectedFightCount === 0 || (lookupMode === 'global' && !hasGlobalSelection) ? 1 :
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

  const buildRequest = (params?: {
    forExport?: boolean
    playerNameOverride?: string
    reportCodesOverride?: string[]
    fightIdsByReportOverride?: Record<string, number[]>
  }): PlayerAnalysisExportRequest => {
    const fightSelectionForRequest = params?.fightIdsByReportOverride ?? bossKillSelection.selectedFightIdsByReport
    const selectedReportCodesForExport = params?.forExport
      ? Object.entries(fightSelectionForRequest)
          .filter(([, fightIds]) => fightIds.length > 0)
          .map(([reportCode]) => reportCode)
      : []

    const reportCodes =
      params?.reportCodesOverride
      ?? (timeframePreset === 'manualReports' ? selectedReports : undefined)
      ?? (selectedReportCodesForExport.length > 0 ? selectedReportCodesForExport : undefined)

    return {
      playerName: params?.playerNameOverride ?? playerName,
      timeframePreset,
      reportCodes,
      fightIdsByReport: params?.forExport ? fightSelectionForRequest : params?.fightIdsByReportOverride,
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
    }
  }

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

  const handlePreview = (
    playerNameOverride?: string,
    options?: { reportCodesOverride?: string[]; fightIdsByReportOverride?: Record<string, number[]>; preselectedFight?: { reportCode: string; fightId: number } }
  ) => {
    bossKillSelection.syncSelectedBaselineKeys(new Set())
    const requestId = previewRequestSeq.current + 1
    previewRequestSeq.current = requestId
    previewMutation.mutate(
      buildRequest({
        playerNameOverride,
        reportCodesOverride: options?.reportCodesOverride,
        fightIdsByReportOverride: options?.fightIdsByReportOverride,
      }),
      {
      onSuccess: (data) => {
        if (requestId !== previewRequestSeq.current) return
        const nextSelection: Record<string, number[]> = Object.fromEntries(
          (data.includedReports ?? []).map((r) => [r.code, [] as number[]])
        )
        if (options?.preselectedFight && nextSelection[options.preselectedFight.reportCode] !== undefined) {
          nextSelection[options.preselectedFight.reportCode] = [options.preselectedFight.fightId]
        }
        bossKillSelection.setSelectedFightIdsByReport(nextSelection)
        const baselineKeys = buildBaselineKeysFromFightSelection(data, nextSelection)
        bossKillSelection.syncSelectedBaselineKeys(baselineKeys)
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

  const handleLookupModeChange = (nextMode: 'guild' | 'global') => {
    setLookupMode(nextMode)
    setForcedStep(null)
    invalidatePreviewState({ resetUserContext: false })
    if (nextMode === 'guild') {
      setGlobalLookupValidationError(null)
      globalBossKillsMutation.reset()
      setSelectedGlobalBossKill(null)
    }
  }

  const handleLoadGlobalBossKills = () => {
    setGlobalLookupValidationError(null)
    const builtRequest = buildGlobalBossKillsRequest({ wclSite: context.wclSite }, globalLookupInput)
    if (!builtRequest.ok) {
      setGlobalLookupValidationError(builtRequest.error)
      return
    }
    invalidatePreviewState({ resetUserContext: true })
    setForcedStep(1)
    setSelectedGlobalBossKill(null)
    globalBossKillsMutation.reset()
    globalBossKillsMutation.mutate(builtRequest.request, {
      onSuccess: (result) => {
        const resolvedName = result.character?.name?.trim()
        if (resolvedName) {
          setPlayerName(resolvedName)
          setPendingClassName(result.character?.className ?? null)
        }
      },
    })
  }

  const handleSelectGlobalBossKill = (fight: GlobalCharacterBossKill) => {
    const selectedPlayerName = globalResult?.character?.name?.trim() || playerName.trim()
    if (!selectedPlayerName) return
    setSelectedGlobalBossKill(fight)
    setPendingClassName(fight.className ?? globalResult?.character?.className ?? null)
    if (fight.className && fight.specName) {
      benchmarkFormState.setPlayerUserContext({
        className: fight.className,
        specName: fight.specName,
        role: getRoleForSpec(fight.className, fight.specName) ?? undefined,
      })
    } else {
      benchmarkFormState.setPlayerUserContext(null)
      benchmarkFormState.setBenchmarkContextSource('wclDetected')
    }
    handleScopeFieldChange(() => setPlayerName(selectedPlayerName), { resetUserContext: false })
    setForcedStep(1)
    handlePreview(selectedPlayerName, {
      reportCodesOverride: [fight.reportCode],
      fightIdsByReportOverride: { [fight.reportCode]: [fight.fightId] },
      preselectedFight: { reportCode: fight.reportCode, fightId: fight.fightId },
    })
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
            className: globalBossKillByKey.get(`${r.code}:${f.fightId}`)?.className ?? effectiveClassName,
            specName: f.playerSpecName ?? globalBossKillByKey.get(`${r.code}:${f.fightId}`)?.specName ?? effectiveSpecName,
            itemLevel: f.playerItemLevel ?? globalBossKillByKey.get(`${r.code}:${f.fightId}`)?.playerItemLevel ?? null,
            playerParse: f.playerParse ?? globalBossKillByKey.get(`${r.code}:${f.fightId}`)?.percentile ?? null,
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
    globalBossKillsMutation,
    recentPlayersQuery,
    recentReportsQuery,
    // Derived from queries
    preview,
    job,
    players,
    reports,
    globalResult,
    globalBossKills,
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
    lookupMode,
    setLookupMode: handleLookupModeChange,
    hasGuildId,
    globalLookupInput,
    setGlobalLookupInput: (value: GlobalCharacterLookupInput) => setGlobalLookupInputState(value),
    globalLookupValidationError,
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
    hasGlobalLookupAttempt,
    hasGlobalSelection,
    // Helpers
    // Action handlers
    handlePreview,
    handleLoadGlobalBossKills,
    handleSelectGlobalBossKill,
    handleGenerateExport,
    handleFindCandidates,
    handleTargetTierChange,
    handleScopeFieldChange,
    handleSelectBossKill,
    handlePlayerSelect,
    resetLastPreviewedName: () => { lastAutoPreviewedName.current = '' },
  }
}
