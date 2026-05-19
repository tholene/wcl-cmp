import { useRef, useState, type FC } from 'react'
import { useRecentReports } from '@/features/reports/hooks/use-recent-reports'
import type { ReportSummary } from '@/features/reports/types/report-summary'
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
import {
  STABLE_EXPORT_VIEWS,
  type BenchmarkCandidatesResponse,
  type PlayerAnalysisExportRequest,
  type PlayerAnalysisExportView,
  type PlayerAnalysisTimeframePreset,
  type SelectedBenchmarkCandidate,
} from '../types/player-analysis.types'
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
  role?: WowRole
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
  selectedKeys: Set<string>,
  selectedCandidateKeysByBaseline: Record<string, string>
): SelectedBenchmarkCandidate[] {
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

const KNOWN_RAID_ZONE_IDS = new Set<number>([26, 27, 28, 31, 33, 35, 38])
const KNOWN_RAID_ZONE_NAMES = new Set<string>([
  'castle nathria',
  'sanctum of domination',
  'sepulcher of the first ones',
  'vault of the incarnates',
  'aberrus, the shadowed crucible',
  "amirdrassil, the dream's hope",
  'nerub-ar palace',
])
const RAID_NAME_HINTS = ['raid', 'palace', 'vault', 'sanctum', 'sepulcher', 'aberrus', 'amirdrassil', 'nathria']
const NON_RAID_NAME_HINTS = ['mythic+', 'mythic plus', 'dungeon', 'keystone', 'timewalking', 'arena', 'battleground', 'skirmish']

function normalizeZoneName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function isRaidReport(report: ReportSummary): boolean {
  if (typeof report.zoneId === 'number' && KNOWN_RAID_ZONE_IDS.has(report.zoneId)) return true
  const zoneName = normalizeZoneName(report.zoneName)
  if (!zoneName) return false
  if (KNOWN_RAID_ZONE_NAMES.has(zoneName)) return true
  if (NON_RAID_NAME_HINTS.some((hint) => zoneName.includes(hint))) return false
  return RAID_NAME_HINTS.some((hint) => zoneName.includes(hint))
}

function selectLatestRaidReportCodes(reports: ReportSummary[]): string[] {
  if (reports.length === 0) return []
  const raidReports = reports.filter(isRaidReport)
  if (raidReports.length === 0) return []
  const sorted = [...raidReports].sort((left, right) => right.startTime - left.startTime)
  const latest = sorted[0]
  const latestZone = normalizeZoneName(latest.zoneName)
  const maxWindowMs = 6 * 60 * 60 * 1000

  return sorted
    .filter((report) => {
      if (latest.startTime - report.startTime > maxWindowMs) return false
      const zone = normalizeZoneName(report.zoneName)
      return !!zone && zone === latestZone
    })
    .map((report) => report.code)
}

function buildSingleBossDefaultSelection(preview: {
  recentRaidBossKills?: {
    groups: Array<{
      fights: Array<{
        reportCode: string
        fightId: number
        startTime: number
        durationMs: number
      }>
    }>
  }
  includedReports: Array<{ code: string }>
}): Record<string, number[]> {
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

function buildAllEligibleFightSelection(preview: {
  includedReports: Array<{
    code: string
    includedFights: Array<{
      fightId: number
      encounterId?: number
      playerPresent: boolean
      durationMs: number
    }>
  }>
}): Record<string, number[]> {
  const selected: Record<string, number[]> = {}
  for (const report of preview.includedReports ?? []) {
    selected[report.code] = (report.includedFights ?? [])
      .filter((fight) => fight.playerPresent && (fight.encounterId ?? 0) > 0 && fight.durationMs >= 60_000)
      .map((fight) => fight.fightId)
  }
  return selected
}

function countSelectedFights(selection: Record<string, number[]>): number {
  return Object.values(selection).reduce((sum, fightIds) => sum + fightIds.length, 0)
}

function buildBaselineKeysFromFightSelection(
  preview: {
    includedReports: Array<{
      code: string
      includedFights: Array<{
        fightId: number
        encounterId?: number
        playerPresent: boolean
        durationMs: number
      }>
    }>
  },
  selection: Record<string, number[]>
): Set<string> {
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

export const PlayerAnalysisPage: FC = () => {
  const recentPlayersQuery = useRecentPlayers()
  const recentReportsQuery = useRecentReports()
  const previewMutation = usePlayerAnalysisPreview()
  const exportJob = usePlayerAnalysisExportJob()
  const benchmarkCandidatesMutation = useBenchmarkCandidates()

  const [playerName, setPlayerName] = useState('')
  const [timeframePreset, setTimeframePreset] = useState<PlayerAnalysisTimeframePreset>('latestRaid')
  const [selectedReports, setSelectedReports] = useState<string[]>([])
  const [includeKills, setIncludeKills] = useState(true)
  const [includeWipes, setIncludeWipes] = useState(false)
  const [includeTrash, setIncludeTrash] = useState(false)
  const [onlyPlayerPresent, setOnlyPlayerPresent] = useState(true)
  const [selectedViews, setSelectedViews] = useState<PlayerAnalysisExportView[]>([...STABLE_EXPORT_VIEWS])
  const [selectedFightIdsByReport, setSelectedFightIdsByReport] = useState<Record<string, number[]>>({})

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
  const [allowSubjectOnlyWithoutBenchmark, setAllowSubjectOnlyWithoutBenchmark] = useState(false)
  const [selectedBaselineKeys, setSelectedBaselineKeys] = useState<Set<string>>(new Set())
  const [selectedCandidateKeysByBaseline, setSelectedCandidateKeysByBaseline] = useState<Record<string, string>>({})
  const [playerUserContext, setPlayerUserContext] = useState<ClassSpecOverride | null>(null)
  const [benchmarkContextSource, setBenchmarkContextSource] = useState<'wclDetected' | 'userProvided'>('wclDetected')
  const previewRequestSeq = useRef(0)

  const preview = previewMutation.data ?? null
  const job = exportJob.jobStatus

  const wclClassName = preview?.detectedPlayer?.className !== 'unknown' ? preview?.detectedPlayer?.className ?? null : null
  const wclSpecName = preview?.detectedPlayer?.specName !== 'unknown' ? preview?.detectedPlayer?.specName ?? null : null
  const hasWclClassSpec = !!wclClassName && !!wclSpecName
  const hasUserClassSpec = !!playerUserContext?.className && !!playerUserContext?.specName
  const selectedUserSource = benchmarkContextSource === 'userProvided'
  const effectiveClassName = selectedUserSource
    ? (hasUserClassSpec ? playerUserContext?.className ?? null : null)
    : hasWclClassSpec
      ? wclClassName
      : hasUserClassSpec
        ? playerUserContext?.className ?? null
        : null
  const effectiveSpecName = selectedUserSource
    ? (hasUserClassSpec ? playerUserContext?.specName ?? null : null)
    : hasWclClassSpec
      ? wclSpecName
      : hasUserClassSpec
        ? playerUserContext?.specName ?? null
        : null
  const specDetectionFailed = !!preview && (!wclClassName || !wclSpecName)

  // Boss fights where the player was present, duration ≥ 60s — available for baseline selection
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
              specName: effectiveSpecName ?? 'unknown',
              itemLevel: f.playerItemLevel ?? null,
            }))
        )
    : []

  const contextSource = hasWclClassSpec && benchmarkContextSource !== 'userProvided'
    ? ('wclDetected' as const)
    : ('userProvided' as const)
  const syncSelectedBaselineKeys = (nextKeys: Set<string>) => {
    setSelectedBaselineKeys(nextKeys)
    setSelectedCandidateKeysByBaseline((current) => {
      const filtered: Record<string, string> = {}
      for (const baselineKey of Object.keys(current)) {
        if (nextKeys.has(baselineKey)) {
          filtered[baselineKey] = current[baselineKey]
        }
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

  const buildRequest = (params?: { forExport?: boolean }): PlayerAnalysisExportRequest => {
    const reportCodes =
      timeframePreset === 'manualReports'
        ? selectedReports
        : undefined

    return {
      playerName,
      timeframePreset,
      reportCodes,
      fightIdsByReport: params?.forExport ? selectedFightIdsByReport : undefined,
      includeKills,
      includeWipes,
      includeTrash,
      onlyPlayerPresent,
      views: selectedViews,
      playerContext: playerUserContext
        ? {
            className: playerUserContext.className || undefined,
            specName: playerUserContext.specName || undefined,
            role: playerUserContext.specName ? playerUserContext.role : undefined,
            source: 'userProvided' as const,
          }
        : undefined,
      benchmarkContextSource,
      ...(benchmarkMode !== 'none'
        ? {
            benchmark: {
              requested: true as const,
              mode: benchmarkMode,
              targetPercentile: benchmarkMode === 'auto' ? autoBenchmarkConfig.targetPercentile : undefined,
              metric: benchmarkMode === 'auto' ? autoBenchmarkConfig.metric : undefined,
              allowSubjectOnlyWithoutBenchmark:
                benchmarkBlockedReason && allowSubjectOnlyWithoutBenchmark ? true : undefined,
              ...(benchmarkMode === 'manual' &&
              manualBenchmarkConfig.reportCode.trim() &&
              manualBenchmarkConfig.fightId.trim() &&
              manualBenchmarkConfig.playerName.trim()
                ? {
                    manualTarget: {
                      reportCode: manualBenchmarkConfig.reportCode.trim(),
                      fightId: Number(manualBenchmarkConfig.fightId),
                      playerName: manualBenchmarkConfig.playerName.trim(),
                    },
                  }
                : {}),
              ...(benchmarkMode === 'auto'
                ? {
                    selectedCandidates: buildSelectedCandidates(
                      availableBaselines,
                      benchmarkCandidatesMutation.data ?? null,
                      selectedBaselineKeys,
                      selectedCandidateKeysByBaseline
                    ),
                  }
                : {}),
            },
          }
        : {}),
    }
  }

  const handlePreview = () => {
    syncSelectedBaselineKeys(new Set())
    const requestId = previewRequestSeq.current + 1
    previewRequestSeq.current = requestId
    previewMutation.mutate(buildRequest(), {
      onSuccess: (data) => {
        if (requestId !== previewRequestSeq.current) {
          return
        }

        const defaultFightSelection = buildSingleBossDefaultSelection(data)
        setSelectedFightIdsByReport(defaultFightSelection)
        syncSelectedBaselineKeys(buildBaselineKeysFromFightSelection(data, defaultFightSelection))
        if (
          benchmarkContextSource === 'wclDetected' &&
          data.effectiveContext?.source === 'userProvided'
        ) {
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
    benchmarkCandidatesMutation.mutate(
      {
        baselines,
        targetPercentile: autoBenchmarkConfig.targetPercentile,
        metric: autoBenchmarkConfig.metric,
        itemLevelWindow: autoBenchmarkConfig.itemLevelWindow,
        durationWindowPercent: autoBenchmarkConfig.durationWindowPercent,
        maxCandidatesPerFight: 10,
        benchmarkContextSource,
        playerContext: playerUserContext
          ? { ...playerUserContext, role: playerUserContext.role, source: 'userProvided' as const }
          : undefined,
      },
      {
        onSuccess: (data) => {
          const nextSelections: Record<string, string> = {}
          for (const group of data.groups ?? []) {
            const baselineKey = `${group.baseline.reportCode}:${group.baseline.fightId}`
            const recommended = group.selectedCandidate
            if (
              recommended?.validation.hasUsableExportTarget &&
              recommended.reportCode &&
              typeof recommended.fightId === 'number'
            ) {
              nextSelections[baselineKey] = `${recommended.reportCode}:${recommended.fightId}:${recommended.characterName}`
            }
          }
          setSelectedCandidateKeysByBaseline(nextSelections)
        },
      }
    )
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
      if (preview) {
        syncSelectedBaselineKeys(buildBaselineKeysFromFightSelection(preview, nextSelection))
      }
      return nextSelection
    })
  }

  const handleBaselineSelectionChange = (next: Set<string>) => {
    syncSelectedBaselineKeys(next)
  }

  const handleBenchmarkCandidateSelection = (baselineKey: string, candidateKey: string) => {
    setSelectedCandidateKeysByBaseline((current) => ({
      ...current,
      [baselineKey]: candidateKey,
    }))
  }

  const handleSelectAllEligibleFights = () => {
    if (!preview) return
    const nextSelection = buildAllEligibleFightSelection(preview)
    setSelectedFightIdsByReport(nextSelection)
    syncSelectedBaselineKeys(buildBaselineKeysFromFightSelection(preview, nextSelection))
  }

  const handleSelectSingleBossFight = () => {
    if (!preview) return
    const nextSelection = buildSingleBossDefaultSelection(preview)
    setSelectedFightIdsByReport(nextSelection)
    syncSelectedBaselineKeys(buildBaselineKeysFromFightSelection(preview, nextSelection))
  }

  const handleSelectBossKill = (reportCode: string, fightId: number) => {
    if (!preview) return
    const nextSelection: Record<string, number[]> = Object.fromEntries(
      (preview.includedReports ?? []).map((report) => [report.code, report.code === reportCode ? [fightId] : []])
    )
    setSelectedFightIdsByReport(nextSelection)
    syncSelectedBaselineKeys(buildBaselineKeysFromFightSelection(preview, nextSelection))
  }

  const handleClearFightSelection = () => {
    if (!preview) return
    const empty: Record<string, number[]> = {}
    for (const report of preview.includedReports ?? []) {
      empty[report.code] = []
    }
    setSelectedFightIdsByReport(empty)
    syncSelectedBaselineKeys(new Set())
  }

  const canFindCandidates =
    !!preview &&
    selectedBaselineKeys.size > 0 &&
    !!preview.detectedPlayer &&
    !!effectiveClassName &&
    !!effectiveSpecName

  const selectedBaselineKeysList = [...selectedBaselineKeys]
  const selectedAutoCandidates = buildSelectedCandidates(
    availableBaselines,
    benchmarkCandidatesMutation.data ?? null,
    selectedBaselineKeys,
    selectedCandidateKeysByBaseline
  )
  const selectedGroupCount =
    benchmarkCandidatesMutation.data?.groups.filter((group) =>
      selectedBaselineKeys.has(`${group.baseline.reportCode}:${group.baseline.fightId}`)
    ).length ?? 0
  const selectedExportableCount =
    benchmarkCandidatesMutation.data?.groups.filter((group) => {
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
      ? selectedBaselineKeysList.length === 0
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
  const exportBlockedReason =
    benchmarkBlockedReason && !allowSubjectOnlyWithoutBenchmark ? benchmarkBlockedReason : null

  const showProgress = exportJob.isStarting || job !== null
  const showResults = !!job && (job.status === 'complete' || job.status === 'partial' || ((job.status === 'failed') && (job.files?.length ?? 0) > 0))

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
  const latestRaidReportCodes = selectLatestRaidReportCodes(reports)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Player Analysis Export</h1>
        <p className="mt-0.5 text-xs text-slate-400">Export Warcraft Logs data without manually opening every WCL view.</p>
      </div>
      <div className="rounded border border-slate-800 bg-slate-900/50 p-3 text-xs text-slate-300">
        Workflow: 1) Player 2) Raid/Boss 3) Benchmark 4) Export. Default flow analyzes one boss fight first; multi-fight export is optional.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4">
          <PlayerAnalysisScopeForm
            players={players}
            reports={reports}
            latestRaidReportCodes={latestRaidReportCodes}
            recentPlayersLoading={recentPlayersQuery.isLoading}
            recentPlayersError={recentPlayersQuery.error instanceof Error ? recentPlayersQuery.error.message : null}
            reportsLoading={recentReportsQuery.isLoading}
            reportsError={recentReportsQuery.error instanceof Error ? recentReportsQuery.error.message : null}
            playerName={playerName}
            timeframePreset={timeframePreset}
            selectedReports={selectedReports}
            includeKills={includeKills}
            includeWipes={includeWipes}
            includeTrash={includeTrash}
            onlyPlayerPresent={onlyPlayerPresent}
            onPlayerNameChange={(value) => handleScopeFieldChange(() => setPlayerName(value), { resetUserContext: true })}
            onTimeframePresetChange={(value) => handleScopeFieldChange(() => setTimeframePreset(value))}
            onSelectedReportsChange={(value) => handleScopeFieldChange(() => setSelectedReports(value))}
            onIncludeKillsChange={(value) => handleScopeFieldChange(() => setIncludeKills(value))}
            onIncludeWipesChange={(value) => handleScopeFieldChange(() => setIncludeWipes(value))}
            onIncludeTrashChange={(value) => handleScopeFieldChange(() => setIncludeTrash(value))}
            onOnlyPlayerPresentChange={(value) => handleScopeFieldChange(() => setOnlyPlayerPresent(value))}
            onPreview={handlePreview}
            isPreviewing={previewMutation.isPending}
            previewButtonLabel={timeframePreset === 'latestRaid' ? 'Preview latest raid' : 'Preview selected scope'}
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
              hasPreview={!!preview}
              availableBaselines={availableBaselines}
              selectedBaselineKeys={selectedBaselineKeys}
              selectedCandidateKeysByBaseline={selectedCandidateKeysByBaseline}
              specDetectionFailed={specDetectionFailed}
              detectedContext={preview?.detectedPlayer?.detectedContext}
              contextWarnings={preview?.contextWarnings ?? []}
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
              selectedFightIdsByReport={selectedFightIdsByReport}
              onSelectBossKill={handleSelectBossKill}
              onFightSelectionChange={handleFightSelectionChange}
              onAnalyzeSingleBoss={handleSelectSingleBossFight}
              onSelectAllEligibleFights={handleSelectAllEligibleFights}
              onClearFightSelection={handleClearFightSelection}
              onGenerateExport={handleGenerateExport}
              isGenerating={exportJob.isStarting}
              viewCount={selectedViews.length}
              exportBlockedReason={exportBlockedReason}
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

          {exportJob.pollError && (
            <div className="rounded border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-amber-200">
              {exportJob.pollError}
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
