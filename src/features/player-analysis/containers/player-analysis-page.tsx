import { useRef, useState, type FC } from 'react'
import { useRecentReports } from '@/features/reports/hooks/use-recent-reports'
import type { ReportSummary } from '@/features/reports/types/report-summary'
import { getDifficultyLabel } from '@/lib/difficulty'
import { BenchmarkErrorBoundary } from '../components/benchmark-error-boundary'
import { BossKillCard } from '../components/boss-kill-card'
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

const RAID_CLASSIFICATION_CONFIG = {
  zoneIds: [26, 27, 28, 31, 33, 35, 38, 46],
  zoneNames: [
    'castle nathria',
    'sanctum of domination',
    'sepulcher of the first ones',
    'vault of the incarnates',
    'aberrus, the shadowed crucible',
    "amirdrassil, the dream's hope",
    'nerub-ar palace',
    'liberation of undermine',
  ],
  aliases: ['vs / dr / mqd', 'vs/dr/mqd', 'vs-dr-mqd'],
  raidHints: ['raid', 'palace', 'vault', 'sanctum', 'sepulcher', 'aberrus', 'amirdrassil', 'nathria', 'undermine', 'reclear'],
  nonRaidHints: ['mythic+', 'mythic plus', 'dungeon', 'keystone', 'timewalking', 'arena', 'battleground', 'skirmish'],
} as const

const RAID_ZONE_ID_SET = new Set<number>(RAID_CLASSIFICATION_CONFIG.zoneIds)
const RAID_ZONE_NAME_SET = new Set<string>(RAID_CLASSIFICATION_CONFIG.zoneNames)
const RAID_ZONE_ALIAS_SET = new Set<string>(RAID_CLASSIFICATION_CONFIG.aliases)

function normalizeZoneName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function isRaidReport(report: ReportSummary): boolean {
  if (typeof report.zoneId === 'number' && RAID_ZONE_ID_SET.has(report.zoneId)) return true
  const zoneName = normalizeZoneName(report.zoneName)
  if (!zoneName) return false
  if (RAID_ZONE_NAME_SET.has(zoneName)) return true
  if (RAID_ZONE_ALIAS_SET.has(zoneName)) return true
  if (RAID_CLASSIFICATION_CONFIG.nonRaidHints.some((hint) => zoneName.includes(hint))) return false
  return RAID_CLASSIFICATION_CONFIG.raidHints.some((hint) => zoneName.includes(hint))
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

  const [benchmarkMode, setBenchmarkMode] = useState<'none' | 'manual' | 'auto'>('auto')
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
  // Tracks which player name last triggered an auto-preview, to prevent duplicate triggers
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

  const buildRequest = (params?: { forExport?: boolean; playerNameOverride?: string }): PlayerAnalysisExportRequest => {
    const reportCodes =
      timeframePreset === 'manualReports'
        ? selectedReports
        : undefined

    return {
      playerName: params?.playerNameOverride ?? playerName,
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

  // Shared benchmark candidate fetch logic. Accepts explicit baselines to avoid stale-state issues
  // when called synchronously after a state-mutating handler (boss kill selection, preview success).
  const handleFindCandidatesWithKeys = (keysOverride: Set<string>, baselinesOverride?: AvailableBaseline[]) => {
    if (!preview || keysOverride.size === 0 || !preview.detectedPlayer) return
    const baselinesSource = baselinesOverride ?? availableBaselines
    const baselines = baselinesSource
      .filter((b) => keysOverride.has(b.key))
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
    if (baselines.length === 0) return
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

        // Auto-trigger benchmark for the default selected boss when class/spec is detected
        if (nextBaselineKeys.size === 0) return
        const detectedClass = data.detectedPlayer?.className !== 'unknown'
          ? (data.detectedPlayer?.className ?? null)
          : null
        const detectedSpec = data.detectedPlayer?.specName !== 'unknown'
          ? (data.detectedPlayer?.specName ?? null)
          : null
        const autoClass =
          benchmarkContextSource === 'userProvided' && playerUserContext?.className
            ? playerUserContext.className
            : detectedClass
        const autoSpec =
          benchmarkContextSource === 'userProvided' && playerUserContext?.specName
            ? playerUserContext.specName
            : detectedSpec

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

  const handleSelectBossKill = (reportCode: string, fightId: number) => {
    if (!preview) return
    const nextSelection: Record<string, number[]> = Object.fromEntries(
      (preview.includedReports ?? []).map((report) => [
        report.code,
        report.code === reportCode ? [fightId] : [],
      ])
    )
    setSelectedFightIdsByReport(nextSelection)
    const nextBaselineKeys = buildBaselineKeysFromFightSelection(preview, nextSelection)
    syncSelectedBaselineKeys(nextBaselineKeys)

    if (nextBaselineKeys.size === 0 || !effectiveClassName || !effectiveSpecName) return

    // Compute baselines inline from next selection since state hasn't updated yet
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
  const showResults =
    !!job &&
    (job.status === 'complete' ||
      job.status === 'partial' ||
      (job.status === 'failed' && (job.files?.length ?? 0) > 0))

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

  const selectedFightCount = countSelectedFights(selectedFightIdsByReport)

  // Step visibility
  const showStep2 = previewMutation.isPending || previewMutation.isSuccess || !!previewMutation.error
  const showStep3 = !!preview && selectedFightCount > 0
  // Step 4 appears as soon as a fight is selected; content inside varies by benchmark state
  const showStep4 = showStep3

  const isSelected = (reportCode: string, fightId: number): boolean =>
    (selectedFightIdsByReport[reportCode] ?? []).includes(fightId)

  // First baseline for export summary display
  const firstBaseline = availableBaselines[0] ?? null

  return (
    <div className="mx-auto max-w-[900px] space-y-4 py-6 px-4">
      {/* Page header */}
      <div className="pb-2 text-center">
        <h1 className="text-2xl font-bold text-slate-100">Player Analysis Export</h1>
      </div>

      {/* Step 1 — Player */}
      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Player
        </div>
        <PlayerAnalysisScopeForm
          players={players}
          reports={reports}
          latestRaidReportCodes={latestRaidReportCodes}
          recentPlayersLoading={recentPlayersQuery.isLoading}
          recentPlayersError={
            recentPlayersQuery.error instanceof Error ? recentPlayersQuery.error.message : null
          }
          reportsLoading={recentReportsQuery.isLoading}
          reportsError={
            recentReportsQuery.error instanceof Error ? recentReportsQuery.error.message : null
          }
          playerName={playerName}
          timeframePreset={timeframePreset}
          selectedReports={selectedReports}
          includeKills={includeKills}
          includeWipes={includeWipes}
          includeTrash={includeTrash}
          onlyPlayerPresent={onlyPlayerPresent}
          onPlayerNameChange={(value) => {
            handleScopeFieldChange(() => setPlayerName(value), { resetUserContext: true })
            // Auto-trigger on exact autocomplete match, guarded against repeats
            const normalizedValue = value.trim().toLowerCase()
            if (
              normalizedValue &&
              normalizedValue !== lastAutoPreviewedName.current &&
              players.some((p) => p.name.toLowerCase() === normalizedValue)
            ) {
              lastAutoPreviewedName.current = normalizedValue
              handlePreview(value.trim())
            }
          }}
          onTimeframePresetChange={(value) =>
            handleScopeFieldChange(() => setTimeframePreset(value))
          }
          onSelectedReportsChange={(value) =>
            handleScopeFieldChange(() => setSelectedReports(value))
          }
          onIncludeKillsChange={(value) => handleScopeFieldChange(() => setIncludeKills(value))}
          onIncludeWipesChange={(value) => handleScopeFieldChange(() => setIncludeWipes(value))}
          onIncludeTrashChange={(value) => handleScopeFieldChange(() => setIncludeTrash(value))}
          onOnlyPlayerPresentChange={(value) =>
            handleScopeFieldChange(() => setOnlyPlayerPresent(value))
          }
          onPreview={() => {
            lastAutoPreviewedName.current = playerName.trim().toLowerCase()
            handlePreview(playerName.trim() || undefined)
          }}
          onCommit={() => {
            const trimmed = playerName.trim()
            if (!trimmed) return
            lastAutoPreviewedName.current = trimmed.toLowerCase()
            handlePreview(trimmed)
          }}
          isPreviewing={previewMutation.isPending}
        />
      </section>

      {/* Step 2 — Boss Kill */}
      {showStep2 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Boss Kill
          </div>

          {previewMutation.isPending && (
            <p className="text-sm text-slate-400">Loading boss kills…</p>
          )}

          {previewMutation.error && !previewMutation.isPending && (
            <div className="rounded border border-rose-700/40 bg-rose-950/20 p-3 text-xs text-rose-200">
              {(previewMutation.error as Error).message}
            </div>
          )}

          {preview && !previewMutation.isPending && (
            <>
              {preview.recentRaidBossKills.groups.length === 0 && (
                <p className="text-sm text-slate-400">
                  No verified raid boss kills found for {preview.requestedPlayerName} in this scope.
                </p>
              )}

              <div className="space-y-2">
                {preview.recentRaidBossKills.groups.flatMap((group) =>
                  group.fights.map((fight) => (
                    <BossKillCard
                      key={`${fight.reportCode}:${fight.fightId}`}
                      encounterName={group.encounterName}
                      difficulty={group.difficulty}
                      durationMs={fight.durationMs}
                      startTime={fight.startTime}
                      playerItemLevel={fight.playerItemLevel}
                      reportCode={fight.reportCode}
                      fightId={fight.fightId}
                      isSelected={isSelected(fight.reportCode, fight.fightId)}
                      onClick={() => handleSelectBossKill(fight.reportCode, fight.fightId)}
                    />
                  ))
                )}
              </div>

              {preview.recentRaidBossKills.warnings.length > 0 && (
                <div className="mt-2 rounded border border-amber-700/30 bg-amber-950/20 p-2 text-xs text-amber-200 space-y-1">
                  {preview.recentRaidBossKills.warnings.map((w) => (
                    <p key={w}>⚠ {w}</p>
                  ))}
                </div>
              )}

              <details className="mt-3 rounded border border-slate-700 bg-slate-950/30 p-2">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300">
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
        </section>
      )}

      {/* Step 3 — Benchmark */}
      {showStep3 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Benchmark
          </div>
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
              isAutoTriggered={true}
            />
          </BenchmarkErrorBoundary>
        </section>
      )}

      {/* Step 4 — Export */}
      {showStep4 && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Export
          </div>

          {/* Benchmark status messages — explain why export may not be ready yet */}
          {!showProgress && !showResults && benchmarkMode === 'auto' && (
            <>
              {benchmarkCandidatesMutation.isPending && (
                <p className="mb-4 text-sm text-slate-400">
                  Finding same-spec benchmark candidates…
                </p>
              )}
              {benchmarkCandidatesMutation.isError && (
                <div className="mb-4 rounded border border-rose-700/30 bg-rose-950/20 p-3 text-xs text-rose-200">
                  Benchmark discovery failed. Retry from the Benchmark step or use manual benchmark
                  fallback.
                </div>
              )}
              {benchmarkCandidatesMutation.isSuccess &&
                selectedAutoCandidates.length === 0 &&
                !allowSubjectOnlyWithoutBenchmark && (
                  <div className="mb-4 rounded border border-amber-700/30 bg-amber-950/20 p-3 text-xs text-amber-200">
                    No exportable benchmark candidate found. Use manual benchmark fallback or enable
                    subject-only export in the Benchmark step above.
                  </div>
                )}
            </>
          )}

          {/* Pre-export summary + button */}
          {!showProgress && !showResults && (
            <>
              {firstBaseline && (
                <div className="mb-4 rounded border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-300 space-y-1">
                  <p>
                    Player: <span className="text-slate-100">{playerName}</span>
                  </p>
                  <p>
                    Fight:{' '}
                    <span className="text-slate-100">
                      {firstBaseline.encounterName} —{' '}
                      {getDifficultyLabel(firstBaseline.difficulty)}
                    </span>
                  </p>
                  {selectedAutoCandidates.length > 0 && (
                    <p>
                      Benchmark:{' '}
                      <span className="text-slate-100">
                        {selectedAutoCandidates[0].benchmarkPlayerName}
                      </span>
                    </p>
                  )}
                  {benchmarkMode !== 'none' && effectiveClassName && effectiveSpecName && (
                    <p className="text-slate-400">
                      Comparison: same encounter · same difficulty ·{' '}
                      {effectiveSpecName} {effectiveClassName}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateExport}
                disabled={
                  exportJob.isStarting ||
                  selectedFightCount === 0 ||
                  selectedViews.length === 0 ||
                  !!exportBlockedReason
                }
                className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exportJob.isStarting ? 'Starting export…' : 'Export analysis bundle'}
              </button>

              {exportBlockedReason && !allowSubjectOnlyWithoutBenchmark && (
                <p className="mt-2 text-xs text-amber-300">{exportBlockedReason}</p>
              )}
              {selectedViews.length === 0 && (
                <p className="mt-2 text-xs text-rose-300">
                  No views selected — enable export views in Advanced options below.
                </p>
              )}
            </>
          )}

          {showProgress && !showResults && job && <PlayerAnalysisExportProgress job={job} />}
          {exportJob.isStarting && !job && (
            <div className="text-xs text-slate-400">Starting export…</div>
          )}
          {showResults && job && exportJob.exportId && (
            <PlayerAnalysisExportResults
              job={job}
              exportId={exportJob.exportId}
              onReset={exportJob.reset}
            />
          )}
          {job?.status === 'failed' && !showResults && (
            <button
              type="button"
              onClick={exportJob.reset}
              className="mt-2 w-full rounded border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            >
              Try again
            </button>
          )}
          {exportJob.startError && (
            <div className="mt-2 rounded border border-rose-700/40 bg-rose-950/20 p-3 text-xs text-rose-200">
              {exportJob.startError}
            </div>
          )}
          {exportJob.pollError && (
            <div className="mt-2 rounded border border-amber-700/40 bg-amber-950/20 p-3 text-xs text-amber-200">
              {exportJob.pollError}
            </div>
          )}
        </section>
      )}

      {/* Global advanced options */}
      <details className="rounded-xl border border-slate-700 bg-slate-950/40 p-4">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300">
          Advanced options
        </summary>
        <div className="mt-4 space-y-4">
          <PlayerAnalysisViewsForm
            selectedViews={selectedViews}
            onSelectedViewsChange={setSelectedViews}
          />
        </div>
      </details>
    </div>
  )
}
