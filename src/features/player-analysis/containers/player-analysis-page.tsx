import { useRef, useState, type FC } from 'react'
import { useRecentReports } from '@/features/reports/hooks/use-recent-reports'
import { getDifficultyLabel } from '@/lib/difficulty'
import { AdvancedButton } from '@/features/player-analysis/components/advanced-button'
import { AdvancedSidebar } from '@/features/player-analysis/components/advanced-sidebar'
import { BenchmarkErrorBoundary } from '@/features/player-analysis/components/benchmark-error-boundary'
import { BossImage } from '@/features/player-analysis/components/boss-image'
import { BossKillCard } from '@/features/player-analysis/components/boss-kill-card'
import { ChipChangeBtn } from '@/features/player-analysis/components/chip-change-btn'
import { DiffBadge } from '@/features/player-analysis/components/diff-badge'
import { ExportButton } from '@/features/player-analysis/components/export-button'
import { PercentileBar } from '@/features/player-analysis/components/percentile-bar'
import { PlayerAnalysisBenchmarkForm } from '@/features/player-analysis/components/player-analysis-benchmark-form'
import { PlayerAnalysisExportProgress } from '@/features/player-analysis/components/player-analysis-export-progress'
import { PlayerAnalysisExportResults } from '@/features/player-analysis/components/player-analysis-export-results'
import { PlayerAnalysisPreviewPanel } from '@/features/player-analysis/components/player-analysis-preview-panel'
import { PlayerAnalysisScopeForm } from '@/features/player-analysis/components/player-analysis-scope-form'
import { SpecIcon } from '@/features/player-analysis/components/spec-icon'
import { StepDot } from '@/features/player-analysis/components/step-dot'
import { useBenchmarkCandidates } from '@/features/player-analysis/hooks/use-benchmark-candidates'
import { usePlayerAnalysisExportJob } from '@/features/player-analysis/hooks/use-player-analysis-export-job'
import { usePlayerAnalysisPreview } from '@/features/player-analysis/hooks/use-player-analysis-preview'
import { useRecentPlayers } from '@/features/player-analysis/hooks/use-recent-players'
import { classColor } from '@/features/player-analysis/lib/class-colors'
import type { AvailableBaseline } from '@/features/player-analysis/types/available-baseline'
import type { ClassSpecOverride } from '@/features/player-analysis/types/class-spec-override'
import {
  STABLE_EXPORT_VIEWS,
  type BenchmarkCandidatesResponse,
  type PlayerAnalysisExportRequest,
  type PlayerAnalysisExportView,
  type PlayerAnalysisTimeframePreset,
  type SelectedBenchmarkCandidate,
} from '@/features/player-analysis/types/player-analysis.types'

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

const buildSelectedCandidates = (
  baselines: AvailableBaseline[],
  candidatesResult: BenchmarkCandidatesResponse | null,
  selectedKeys: Set<string>,
  selectedCandidateKeysByBaseline: Record<string, string>
): SelectedBenchmarkCandidate[] => {
  if (!candidatesResult) return []
  const result: SelectedBenchmarkCandidate[] = []
  for (const group of candidatesResult.groups ?? []) {
    const baseline = baselines.find(
      (b) => b.reportCode === group.baseline.reportCode && b.fightId === group.baseline.fightId
    )
    if (!baseline || !selectedKeys.has(baseline.key)) continue
    const selectedCandidateKey = selectedCandidateKeysByBaseline[baseline.key]
    if (!selectedCandidateKey) continue
    const selectedCandidate = group.candidates.find((candidateItem) => {
      const reportCode = candidateItem.reportCode ?? ''
      const fightId = candidateItem.fightId ?? 0
      const player = candidateItem.characterName ?? ''
      return `${reportCode}:${fightId}:${player}` === selectedCandidateKey
    })
    const candidate = selectedCandidate
    if (!candidate?.validation.hasUsableExportTarget) continue
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
      benchmarkCandidateItemLevel: candidate.itemLevel ?? undefined,
      benchmarkItemLevel: candidate.itemLevel ?? undefined,
      benchmarkDurationMs: candidate.durationMs ?? undefined,
    })
  }
  return result
}


const buildSingleBossDefaultSelection = (preview: {
  recentRaidBossKills?: {
    groups: Array<{
      fights: Array<{ reportCode: string; fightId: number; startTime: number; durationMs: number }>
    }>
  }
  includedReports: Array<{ code: string }>
}): Record<string, number[]> => {
  const selected: Record<string, number[]> = Object.fromEntries(
    (preview.includedReports ?? []).map((report) => [report.code, [] as number[]])
  )
  const candidates = (preview.recentRaidBossKills?.groups ?? []).flatMap((group) =>
    group.fights.map((fight) => ({
      reportCode: fight.reportCode,
      fightId: fight.fightId,
      startTime: fight.startTime ?? 0,
      durationMs: fight.durationMs ?? 0,
    }))
  )
  if (candidates.length === 0) return selected
  candidates.sort((left, right) => {
    if (left.startTime !== right.startTime) return right.startTime - left.startTime
    return right.durationMs - left.durationMs
  })
  const chosen = candidates[0]
  selected[chosen.reportCode] = [chosen.fightId]
  return selected
}

const buildAllEligibleFightSelection = (preview: {
  includedReports: Array<{
    code: string
    includedFights: Array<{ fightId: number; encounterId?: number; playerPresent: boolean; durationMs: number }>
  }>
}): Record<string, number[]> => {
  const selected: Record<string, number[]> = {}
  for (const report of preview.includedReports ?? []) {
    selected[report.code] = (report.includedFights ?? [])
      .filter((fight) => fight.playerPresent && (fight.encounterId ?? 0) > 0 && fight.durationMs >= 60_000)
      .map((fight) => fight.fightId)
  }
  return selected
}

const countSelectedFights = (selection: Record<string, number[]>): number =>
  Object.values(selection).reduce((sum, fightIds) => sum + fightIds.length, 0)

const buildBaselineKeysFromFightSelection = (
  preview: {
    includedReports: Array<{
      code: string
      includedFights: Array<{ fightId: number; encounterId?: number; playerPresent: boolean; durationMs: number }>
    }>
  },
  selection: Record<string, number[]>
): Set<string> => {
  const next = new Set<string>()
  for (const report of preview.includedReports ?? []) {
    const selectedFightIds = new Set(selection[report.code] ?? [])
    for (const fight of report.includedFights ?? []) {
      if (!selectedFightIds.has(fight.fightId)) continue
      if ((fight.encounterId ?? 0) <= 0) continue
      if (!fight.playerPresent) continue
      if (fight.durationMs < 60_000) continue
      next.add(`${report.code}:${fight.fightId}`)
    }
  }
  return next
}

const formatDuration = (ms: number): string => {
  const s = Math.max(Math.floor(ms / 1000), 0)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}


export const PlayerAnalysisPage: FC = () => {
  const recentPlayersQuery = useRecentPlayers()
  const recentReportsQuery = useRecentReports()
  const previewMutation = usePlayerAnalysisPreview()
  const exportJob = usePlayerAnalysisExportJob()
  const benchmarkCandidatesMutation = useBenchmarkCandidates()

  const [playerName, setPlayerName] = useState('')
  const [timeframePreset, setTimeframePreset] = useState<PlayerAnalysisTimeframePreset>('last30Days')
  const [selectedReports, setSelectedReports] = useState<string[]>([])
  const [includeKills, setIncludeKills] = useState(true)
  const [includeWipes, setIncludeWipes] = useState(false)
  const [includeTrash, setIncludeTrash] = useState(false)
  const [onlyPlayerPresent, setOnlyPlayerPresent] = useState(true)
  const [selectedViews, setSelectedViews] = useState<PlayerAnalysisExportView[]>([...STABLE_EXPORT_VIEWS])
  const [selectedFightIdsByReport, setSelectedFightIdsByReport] = useState<Record<string, number[]>>({})

  const [benchmarkMode, setBenchmarkMode] = useState<'none' | 'manual' | 'auto'>('auto')
  const [manualBenchmarkConfig, setManualBenchmarkConfig] = useState<ManualBenchmarkConfig>({
    reportCode: '', fightId: '', playerName: '',
  })
  const [autoBenchmarkConfig, setAutoBenchmarkConfig] = useState<AutoBenchmarkConfig>({
    targetPercentile: 75, metric: 'dps', itemLevelWindow: 10, durationWindowPercent: 35,
  })
  const [allowSubjectOnlyWithoutBenchmark, setAllowSubjectOnlyWithoutBenchmark] = useState(false)
  const [selectedBaselineKeys, setSelectedBaselineKeys] = useState<Set<string>>(new Set())
  const [selectedCandidateKeysByBaseline, setSelectedCandidateKeysByBaseline] = useState<Record<string, string>>({})
  const [playerUserContext, setPlayerUserContext] = useState<ClassSpecOverride | null>(null)
  const [benchmarkContextSource, setBenchmarkContextSource] = useState<'wclDetected' | 'userProvided'>('wclDetected')

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [forcedStep, setForcedStep] = useState<number | null>(null)

  const previewRequestSeq = useRef(0)
  const lastAutoPreviewedName = useRef<string>('')

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
        const defaultFightSelection = buildSingleBossDefaultSelection(data)
        setSelectedFightIdsByReport(defaultFightSelection)
        const nextBaselineKeys = buildBaselineKeysFromFightSelection(data, defaultFightSelection)
        syncSelectedBaselineKeys(nextBaselineKeys)
        if (benchmarkContextSource === 'wclDetected' && data.effectiveContext?.source === 'userProvided') {
          setBenchmarkContextSource('userProvided')
        }
        if (nextBaselineKeys.size === 0) return
        const detectedClass = data.detectedPlayer?.className !== 'unknown' ? (data.detectedPlayer?.className ?? null) : null
        const detectedSpec = data.detectedPlayer?.specName !== 'unknown' ? (data.detectedPlayer?.specName ?? null) : null
        const autoClass = benchmarkContextSource === 'userProvided' && playerUserContext?.className ? playerUserContext.className : detectedClass
        const autoSpec = benchmarkContextSource === 'userProvided' && playerUserContext?.specName ? playerUserContext.specName : detectedSpec
        if (!autoClass || !autoSpec) return
        const baselinesForAutoTrigger: AvailableBaseline[] = (data.includedReports ?? [])
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
                playerName: data.detectedPlayer?.characterName ?? '',
                className: autoClass,
                specName: autoSpec,
                itemLevel: f.playerItemLevel ?? null,
              }))
          )
        handleFindCandidatesWithKeys(nextBaselineKeys, baselinesForAutoTrigger)
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

  const canFindCandidates = !!preview && selectedBaselineKeys.size > 0 && !!preview.detectedPlayer && !!effectiveClassName && !!effectiveSpecName

  const selectedAutoCandidates = buildSelectedCandidates(availableBaselines, benchmarkCandidatesMutation.data ?? null, selectedBaselineKeys, selectedCandidateKeysByBaseline)
  const selectedGroupCount = benchmarkCandidatesMutation.data?.groups.filter((group) => selectedBaselineKeys.has(`${group.baseline.reportCode}:${group.baseline.fightId}`)).length ?? 0
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
  const benchmarkManualGuardReason = benchmarkMode === 'manual' && manualMissingFields.length > 0 ? `Manual benchmark is enabled, but missing ${manualMissingFields.join(', ')}.` : null
  const benchmarkBlockedReason = benchmarkAutoGuardReason ?? benchmarkManualGuardReason
  const canUseSubjectOnlyOverride = benchmarkMode !== 'none' && !!benchmarkBlockedReason
  const exportBlockedReason = benchmarkBlockedReason && !allowSubjectOnlyWithoutBenchmark ? benchmarkBlockedReason : null

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

  // Derive active step
  const hasStartedPreview = previewMutation.isPending || previewMutation.isSuccess || !!previewMutation.error
  const derivedActiveStep =
    !hasStartedPreview ? 0 :
    !preview || selectedFightCount === 0 ? 1 :
    benchmarkMode === 'auto' && selectedAutoCandidates.length === 0 && !allowSubjectOnlyWithoutBenchmark ? 2 :
    3
  const activeStep = forcedStep ?? derivedActiveStep

  const isSelected = (reportCode: string, fightId: number): boolean =>
    (selectedFightIdsByReport[reportCode] ?? []).includes(fightId)

  // Step labels
  const STEP_LABELS = ['Select Player', 'Pick a Fight', 'Find Benchmark', 'Export']

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1e1f23', color: '#f2f3f5' }}>

      {/* ── Minimal Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', maxWidth: 700, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#5865f2', display: 'flex' }}>
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5.2 18.8l2-2m8.6-8.6l5.2-5.2h-4V0m0 3h3M3 21l5.2-5.2" />
              <path d="M18.8 18.8l-2-2M10.2 8.2L5 3H1v4l5.2 5.2" />
              <path d="M21 21l-5.2-5.2M14 10l-4 4" />
            </svg>
          </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f2f3f5', letterSpacing: '-0.01em' }}>
            STD Analyzer
          </span>
        </div>
        <AdvancedButton onClick={() => setSidebarOpen(true)} />
      </header>

      {/* ── Accordion Steps ── */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px 60px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STEP_LABELS.map((label, idx) => {
          const completed = idx < activeStep
          const active = idx === activeStep
          if (idx > activeStep) return null

          const borderColor = active
            ? 'rgba(255,255,255,0.08)'
            : completed
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,255,255,0.06)'
          const bgColor = active ? 'rgba(55,57,63,0.90)' : 'rgba(43,45,49,0.72)'

          return (
            <div
              key={idx}
              style={{
                borderRadius: active ? 14 : 12,
                border: `1px solid ${borderColor}`,
                backgroundColor: bgColor,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                transition: 'all 0.25s ease',
              }}
            >
              {/* Step header row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: completed ? '10px 16px' : '14px 16px',
              }}>
                <StepDot number={idx + 1} completed={completed} active={active} />

                {completed ? (
                  // Collapsed chip
                  <>
                    {idx === 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <SpecIcon className={effectiveClassName ?? undefined} specName={effectiveSpecName ?? undefined} size={26} />
                        <span style={{ fontWeight: 600, fontSize: 14, color: classColor(effectiveClassName) }}>{playerName}</span>
                        {effectiveSpecName && effectiveClassName && (
                          <span style={{ color: '#6d6f78', fontSize: 12 }}>{effectiveSpecName} {effectiveClassName}</span>
                        )}
                        <div style={{ flex: 1 }} />
                        <ChipChangeBtn onClick={() => { setForcedStep(0); invalidatePreviewState() }} />
                      </div>
                    )}
                    {idx === 1 && firstBaseline && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <BossImage encounterId={firstBaseline.encounterId} encounterName={firstBaseline.encounterName} size={26} />
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#f2f3f5' }}>{firstBaseline.encounterName}</span>
                        <DiffBadge difficulty={firstBaseline.difficulty} />
                        <span style={{ color: '#6d6f78', fontSize: 12 }}>{formatDuration(firstBaseline.durationMs)}</span>
                        <div style={{ flex: 1 }} />
                        <ChipChangeBtn onClick={() => setForcedStep(1)} />
                      </div>
                    )}
                    {idx === 2 && selectedAutoCandidates.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: '#6d6f78' }}>vs</span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: classColor(selectedAutoCandidates[0].benchmarkClassName) }}>
                          {selectedAutoCandidates[0].benchmarkPlayerName}
                        </span>
                        {selectedAutoCandidates[0].benchmarkPercentile !== undefined && (
                          <PercentileBar value={selectedAutoCandidates[0].benchmarkPercentile} compact />
                        )}
                        {selectedAutoCandidates[0].benchmarkItemLevel != null && (
                          <span style={{ fontSize: 12, color: '#6d6f78' }}>{selectedAutoCandidates[0].benchmarkItemLevel} ilvl</span>
                        )}
                        <div style={{ flex: 1 }} />
                        <ChipChangeBtn onClick={() => setForcedStep(2)} />
                      </div>
                    )}
                    {idx === 2 && selectedAutoCandidates.length === 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: '#949ba4' }}>Benchmark</span>
                        <div style={{ flex: 1 }} />
                        <ChipChangeBtn onClick={() => setForcedStep(2)} />
                      </div>
                    )}
                  </>
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 600, color: active ? '#f2f3f5' : '#6d6f78' }}>
                    {label}
                  </span>
                )}
              </div>

              {/* Step content */}
              {active && (
                <div style={{ padding: '4px 16px 18px', paddingLeft: 56 }}>

                  {/* ── Step 0: Player Search ── */}
                  {idx === 0 && (
                    <PlayerAnalysisScopeForm
                      players={players}
                      recentPlayersLoading={recentPlayersQuery.isLoading}
                      recentPlayersError={recentPlayersQuery.error instanceof Error ? recentPlayersQuery.error.message : null}
                      playerName={playerName}
                      onPlayerNameChange={(value) => handleScopeFieldChange(() => setPlayerName(value), { resetUserContext: true })}
                      onSelect={handlePlayerSelect}
                      onCommit={() => {
                        const trimmed = playerName.trim()
                        if (!trimmed) return
                        lastAutoPreviewedName.current = trimmed.toLowerCase()
                        setForcedStep(null)
                        handlePreview(trimmed)
                      }}
                      isPreviewing={previewMutation.isPending}
                    />
                  )}

                  {/* ── Step 1: Fight Selection ── */}
                  {idx === 1 && (
                    <div>
                      {previewMutation.isPending && (
                        <p style={{ fontSize: 13, color: '#949ba4' }}>Loading boss kills…</p>
                      )}
                      {previewMutation.error && !previewMutation.isPending && (
                        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(218,55,60,0.08)', border: '1px solid rgba(218,55,60,0.20)', fontSize: 12, color: '#f38ba8' }}>
                          {(previewMutation.error as Error).message}
                        </div>
                      )}
                      {preview && !previewMutation.isPending && (
                        <>
                          {preview.recentRaidBossKills.groups.length === 0 && (
                            <p style={{ fontSize: 13, color: '#949ba4' }}>
                              No verified raid boss kills found for {preview.requestedPlayerName} in this scope.
                            </p>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {preview.recentRaidBossKills.groups.length > 0 && (
                              <div style={{ fontSize: 12, color: '#6d6f78', marginBottom: 2 }}>
                                {preview.recentRaidBossKills.groups.length} boss kills from latest raid
                              </div>
                            )}
                            {preview.recentRaidBossKills.groups.flatMap((group) =>
                              group.fights.map((fight) => (
                                <BossKillCard
                                  key={`${fight.reportCode}:${fight.fightId}`}
                                  encounterName={group.encounterName}
                                  encounterId={group.encounterId}
                                  difficulty={group.difficulty}
                                  durationMs={fight.durationMs}
                                  startTime={fight.startTime}
                                  playerItemLevel={fight.playerItemLevel}
                                  reportCode={fight.reportCode}
                                  fightId={fight.fightId}
                                  isSelected={isSelected(fight.reportCode, fight.fightId)}
                                  duplicateReportCount={fight.duplicateReportCount}
                                  onClick={() => handleSelectBossKill(fight.reportCode, fight.fightId)}
                                />
                              ))
                            )}
                          </div>
                          {preview.recentRaidBossKills.warnings.length > 0 && (
                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.20)', fontSize: 12, color: '#f0b232' }}>
                              {preview.recentRaidBossKills.warnings.map((w) => <p key={w}>⚠ {w}</p>)}
                            </div>
                          )}
                          <details className="mt-3 rounded border border-white/[0.06] bg-[rgba(26,27,30,0.4)] p-2">
                            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
                              Advanced: scope details & manual fight selection
                            </summary>
                            <div className="mt-3">
                              <PlayerAnalysisPreviewPanel
                                preview={preview}
                                selectedFightIdsByReport={selectedFightIdsByReport}
                                onFightSelectionChange={handleFightSelectionChange}
                                onSelectAllEligibleFights={handleSelectAllEligibleFights}
                                onClearFightSelection={handleClearFightSelection}
                                viewCount={selectedViews.length}
                              />
                            </div>
                          </details>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Step 2: Benchmark ── */}
                  {idx === 2 && (
                    <BenchmarkErrorBoundary>
                      <PlayerAnalysisBenchmarkForm
                        benchmarkMode={benchmarkMode}
                        benchmarkConfig={manualBenchmarkConfig}
                        autoConfig={autoBenchmarkConfig}
                        candidatesResult={benchmarkCandidatesMutation.data ?? null}
                        isFindingCandidates={benchmarkCandidatesMutation.isPending}
                        canFindCandidates={canFindCandidates}
                        hasPreview={!!preview}
                        availableBaselines={availableBaselines}
                        selectedBaselineKeys={selectedBaselineKeys}
                        selectedCandidateKeysByBaseline={selectedCandidateKeysByBaseline}
                        specDetectionFailed={specDetectionFailed}
                        detectedContext={preview?.detectedPlayer?.detectedContext}
                        contextWarnings={[...(preview?.contextWarnings ?? []), ...(selectedPlayerFightContext?.warnings ?? [])]}
                        benchmarkContextSource={benchmarkContextSource}
                        playerUserContext={playerUserContext}
                        onBaselineSelectionChange={handleBaselineSelectionChange}
                        onBenchmarkCandidateSelectionChange={handleBenchmarkCandidateSelection}
                        onClassSpecOverrideChange={setPlayerUserContext}
                        onBenchmarkContextSourceChange={setBenchmarkContextSource}
                        onBenchmarkModeChange={setBenchmarkMode}
                        onBenchmarkConfigChange={setManualBenchmarkConfig}
                        onAutoConfigChange={setAutoBenchmarkConfig}
                        benchmarkBlockedReason={benchmarkBlockedReason}
                        canUseSubjectOnlyOverride={canUseSubjectOnlyOverride}
                        allowSubjectOnlyWithoutBenchmark={allowSubjectOnlyWithoutBenchmark}
                        onAllowSubjectOnlyWithoutBenchmarkChange={setAllowSubjectOnlyWithoutBenchmark}
                        onFindCandidates={handleFindCandidates}
                        isAutoTriggered={true}
                      />
                    </BenchmarkErrorBoundary>
                  )}

                  {/* ── Step 3: Export ── */}
                  {idx === 3 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {/* Benchmark loading/error/blocked messages */}
                      {!showProgress && !showResults && benchmarkMode === 'auto' && (
                        <>
                          {benchmarkCandidatesMutation.isPending && (
                            <p style={{ fontSize: 13, color: '#949ba4' }}>Finding same-spec benchmark candidates…</p>
                          )}
                          {benchmarkCandidatesMutation.isError && (
                            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(218,55,60,0.08)', border: '1px solid rgba(218,55,60,0.20)', fontSize: 12, color: '#f38ba8' }}>
                              Benchmark discovery failed. Retry from the Benchmark step or use manual benchmark fallback.
                            </div>
                          )}
                        </>
                      )}

                      {/* Pre-export summary + button */}
                      {!showProgress && !showResults && (
                        <>
                          {firstBaseline && (
                            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(43,45,49,0.72)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <SpecIcon className={effectiveClassName ?? undefined} specName={effectiveSpecName ?? undefined} size={30} />
                                <div>
                                  <span style={{ fontWeight: 600, color: classColor(effectiveClassName) }}>{playerName}</span>
                                  {selectedAutoCandidates.length > 0 && (
                                    <>
                                      <span style={{ color: '#6d6f78', margin: '0 8px' }}>vs</span>
                                      <span style={{ fontWeight: 600, color: classColor(selectedAutoCandidates[0].benchmarkClassName) }}>
                                        {selectedAutoCandidates[0].benchmarkPlayerName}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#949ba4', flexWrap: 'wrap' }}>
                                <span>{firstBaseline.encounterName}</span>
                                <span>{getDifficultyLabel(firstBaseline.difficulty)}</span>
                                <span>{formatDuration(firstBaseline.durationMs)}</span>
                                {benchmarkMode !== 'none' && (
                                  <span>Target: {autoBenchmarkConfig.targetPercentile}th pct</span>
                                )}
                              </div>
                            </div>
                          )}

                          <ExportButton
                            onClick={handleGenerateExport}
                            disabled={exportJob.isStarting || selectedFightCount === 0 || selectedViews.length === 0 || !!exportBlockedReason}
                            isStarting={exportJob.isStarting}
                          />

                          {exportBlockedReason && !allowSubjectOnlyWithoutBenchmark && (
                            <p style={{ fontSize: 12, color: '#f0b232' }}>{exportBlockedReason}</p>
                          )}
                          {selectedViews.length === 0 && (
                            <p style={{ fontSize: 12, color: '#da373c' }}>
                              No views selected — enable export views in Advanced options.
                            </p>
                          )}
                          {exportJob.startError && (
                            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(218,55,60,0.08)', border: '1px solid rgba(218,55,60,0.20)', fontSize: 12, color: '#f38ba8' }}>
                              {exportJob.startError}
                            </div>
                          )}
                        </>
                      )}

                      {showProgress && !showResults && job && <PlayerAnalysisExportProgress job={job} />}
                      {exportJob.isStarting && !job && (
                        <div style={{ fontSize: 12, color: '#949ba4' }}>Starting export…</div>
                      )}
                      {showResults && job && exportJob.exportId && (
                        <PlayerAnalysisExportResults job={job} exportId={exportJob.exportId} onReset={exportJob.reset} />
                      )}
                      {job?.status === 'failed' && !showResults && (
                        <button
                          type="button"
                          onClick={exportJob.reset}
                          style={{ width: '100%', padding: '8px 14px', borderRadius: 8, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#949ba4', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Try again
                        </button>
                      )}
                      {exportJob.pollError && (
                        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.20)', fontSize: 12, color: '#f0b232' }}>
                          {exportJob.pollError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Advanced Sidebar ── */}
      <AdvancedSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        reports={reports}
        reportsLoading={recentReportsQuery.isLoading}
        reportsError={recentReportsQuery.error instanceof Error ? recentReportsQuery.error.message : null}
        timeframePreset={timeframePreset}
        selectedReports={selectedReports}
        includeKills={includeKills}
        includeWipes={includeWipes}
        includeTrash={includeTrash}
        onlyPlayerPresent={onlyPlayerPresent}
        onTimeframePresetChange={(value) => handleScopeFieldChange(() => setTimeframePreset(value))}
        onSelectedReportsChange={(value) => handleScopeFieldChange(() => setSelectedReports(value))}
        onIncludeKillsChange={(value) => handleScopeFieldChange(() => setIncludeKills(value))}
        onIncludeWipesChange={(value) => handleScopeFieldChange(() => setIncludeWipes(value))}
        onIncludeTrashChange={(value) => handleScopeFieldChange(() => setIncludeTrash(value))}
        onOnlyPlayerPresentChange={(value) => handleScopeFieldChange(() => setOnlyPlayerPresent(value))}
        benchmarkMode={benchmarkMode}
        manualBenchmarkConfig={manualBenchmarkConfig}
        autoBenchmarkConfig={autoBenchmarkConfig}
        onBenchmarkModeChange={setBenchmarkMode}
        onManualBenchmarkConfigChange={setManualBenchmarkConfig}
        onAutoConfigChange={setAutoBenchmarkConfig}
        benchmarkContextSource={benchmarkContextSource}
        playerUserContext={playerUserContext}
        onBenchmarkContextSourceChange={setBenchmarkContextSource}
        onClassSpecOverrideChange={setPlayerUserContext}
        selectedViews={selectedViews}
        onSelectedViewsChange={setSelectedViews}
      />
    </div>
  )
}

