export type PlayerAnalysisExportView =
  | 'fightMetadata'
  | 'combatantInfo'
  | 'damageDone'
  | 'damageTaken'
  | 'casts'
  | 'buffs'
  | 'deaths'
  | 'healing'
  /** Experimental — may not be supported by all WCL log types. */
  | 'debuffs'
  /** Experimental — may not be supported by all WCL log types. */
  | 'interrupts'
  /** Experimental — may not be supported by all WCL log types. */
  | 'dispels'
  /** Experimental — may not be supported by all WCL log types. */
  | 'resources'

export const STABLE_EXPORT_VIEWS: PlayerAnalysisExportView[] = [
  'fightMetadata',
  'combatantInfo',
  'damageDone',
  'damageTaken',
  'casts',
  'buffs',
  'deaths',
  'healing',
]

export const EXPERIMENTAL_EXPORT_VIEWS: PlayerAnalysisExportView[] = [
  'debuffs',
  'interrupts',
  'dispels',
  'resources',
]

export type PlayerAnalysisTimeframePreset =
  | 'latestRaid'
  | 'last7Days'
  | 'previousCalendarWeek'
  | 'last14Days'
  | 'manualReports'

export type PlayerAnalysisExportLimits = {
  maxReports: number
  maxFights: number
  maxRowsPerCsv: number
  maxEventsPerFightPerView: number
  maxTotalExportBytes: number
}

export type PlayerBenchmarkTargetPercentile = 50 | 75 | 90

export type BenchmarkBaseline = {
  reportCode: string
  fightId: number
  encounterId: number
  encounterName?: string
  difficulty: number
  durationMs?: number
  playerName: string
  className: string
  specName: string
  itemLevel?: number | null
  contextSource?: 'wclDetected' | 'userProvided'
}

export type AutomatedBenchmarkConfig = {
  mode: 'auto'
  baselines: BenchmarkBaseline[]
  targetPercentile: 50 | 75 | 90
  metric: string
  maxCandidates?: number
  itemLevelWindow?: number
  durationWindowPercent?: number
}

export type ManualBenchmarkConfig = {
  mode: 'manual'
  reportCode: string
  fightId: number
  playerName: string
}

export type PlayerAnalysisBenchmarkConfig = AutomatedBenchmarkConfig | ManualBenchmarkConfig

export type SelectedBenchmarkCandidate = {
  baselineReportCode: string
  baselineFightId: number
  baselineEncounterId: number
  baselineEncounterName: string
  baselineDifficulty: number
  baselineDurationMs?: number
  benchmarkPlayerName: string
  benchmarkReportCode: string
  benchmarkFightId: number
  benchmarkEncounterId: number
  benchmarkDifficulty: number
  benchmarkClassName: string
  benchmarkSpecName: string
  benchmarkPercentile?: number
  /** Ranking metadata item level from WCL character rankings. */
  benchmarkCandidateItemLevel?: number
  /** Deprecated alias; use benchmarkCandidateItemLevel. */
  benchmarkItemLevel?: number
  /** Populated from benchmark fight CombatantInfo when available. */
  benchmarkCombatantInfoItemLevel?: number
  benchmarkDurationMs?: number
}

export type PlayerBenchmarkRequest = {
  requested: boolean
  mode: 'auto' | 'manual'
  targetPercentile?: PlayerBenchmarkTargetPercentile
  metric?: string
  allowSubjectOnlyWithoutBenchmark?: boolean
  selectedCandidates?: SelectedBenchmarkCandidate[]
  manualTarget?: {
    reportCode: string
    fightId: number
    playerName: string
  }
}

export type PlayerDetectedContext = {
  specId?: number
  className?: string
  specName?: string
  role?: 'tank' | 'healer' | 'dps'
  source: 'wclCombatantInfo' | 'wclActor' | 'unknown'
  confidence: 'high' | 'medium' | 'low'
}

export type PlayerUserContext = {
  role?: 'tank' | 'healer' | 'dps'
  className?: string
  specName?: string
  source: 'userProvided'
}

export type PlayerContextSource = 'wclDetected' | 'userProvided' | 'unknown'

export type EffectivePlayerContext = {
  className?: string
  specName?: string
  role?: 'tank' | 'healer' | 'dps' | 'unknown'
  source: PlayerContextSource
}

export type PlayerAnalysisExportRequest = {
  playerName: string
  timeframePreset?: PlayerAnalysisTimeframePreset
  since?: number
  until?: number
  reportCodes?: string[]
  fightIdsByReport?: Record<string, number[]>
  includeKills: boolean
  includeWipes: boolean
  includeTrash?: boolean
  onlyPlayerPresent?: boolean
  views: PlayerAnalysisExportView[]
  benchmark?: PlayerBenchmarkRequest
  limits?: Partial<PlayerAnalysisExportLimits>
  playerContext?: PlayerUserContext
  benchmarkContextSource?: 'wclDetected' | 'userProvided'
}

export type PlayerAnalysisExportFile = {
  filename: string
  kind: 'manifest' | 'readme' | 'csv' | 'json' | 'zip' | 'benchmarkCsv' | 'benchmarkJson'
  view?: PlayerAnalysisExportView
  sizeBytes: number
  rowCount?: number
  downloadUrl: string
}

export type PlayerAnalysisExportPreview = {
  requestedPlayerName: string
  scope: {
    timeframePreset?: PlayerAnalysisTimeframePreset
    since?: number
    until?: number
    reportsScanned: number
    reportsIncluded: number
    fightsScanned: number
    fightsIncluded: number
    onlyPlayerPresent: boolean
  }
  detectedPlayer?: {
    characterName: string
    className: string | 'unknown'
    specName: string | 'unknown'
    role: 'tank' | 'healer' | 'dps' | 'unknown'
    itemLevel: number | null
    sourceIdsByReport: Record<string, number[]>
    detectedContext?: PlayerDetectedContext
    specId?: number
    warnings: string[]
    detectionDiagnostics?: {
      fightsAttempted: number
      playerActorFound: boolean
      actorId?: number
      combatantInfoQueried: boolean
      combatantInfoEventsFound: number
      matchingCombatantInfoFound: boolean
      rawSpecIdFound?: number
      specIdMapped: boolean
      checkedReportCode?: string
      checkedFightId?: number
    }
  }
  includedReports: Array<{
    code: string
    title: string
    url: string
    startTime: number
    playerPresent: boolean
    includedFights: Array<{
      fightId: number
      encounterId?: number
      encounterName: string
      kill: boolean
      difficulty: number
      durationMs: number
      playerPresent: boolean
    }>
    skippedFights: Array<{
      fightId: number
      encounterName: string
      reason: string
    }>
  }>
  estimatedExport: {
    views: PlayerAnalysisExportView[]
    estimatedCsvFiles: number
    estimatedSizeLevel: 'small' | 'medium' | 'large' | 'veryLarge'
    warnings: string[]
  }
  userContext?: PlayerUserContext | null
  effectiveContext?: EffectivePlayerContext
  contextWarnings: string[]
  warnings: string[]
}

export type PlayerBenchmarkMode = 'none' | 'manual' | 'auto'

export type PlayerBenchmarkCandidate = {
  reportCode: string
  fightId: number
  encounterId: number
  encounterName?: string
  difficulty: number
  playerName: string
  className: string
  specName: string
  itemLevel?: number | null
  percentile?: number | null
  rank?: number | null
  metric?: string
  durationMs?: number | null
  reportStartTime?: number | null
  reportUrl?: string
  matchedBy: {
    sameEncounter: boolean
    sameDifficulty: boolean
    sameClass: boolean
    sameSpec: boolean
    itemLevelDelta?: number | null
    durationDeltaPct?: number | null
  }
  warnings: string[]
}

export type BenchmarkCandidatesRequest = {
  baselines: BenchmarkBaseline[]
  targetPercentile: 50 | 75 | 90
  metric: string
  itemLevelWindow?: number
  durationWindowPercent?: number
  maxCandidatesPerFight?: number
  playerContext?: PlayerUserContext
  benchmarkContextSource?: 'wclDetected' | 'userProvided'
}

export type NormalizedBenchmarkCandidate = {
  source: 'wclRankings' | 'manual'
  characterName: string
  className?: string
  specName?: string
  serverName?: string
  serverSlug?: string
  region?: string
  characterUrl?: string
  encounterId: number
  encounterName?: string
  difficulty?: number
  reportCode?: string
  fightId?: number
  percentile?: number
  rank?: number
  metric?: string
  amount?: number
  itemLevel?: number
  bracket?: number
  durationMs?: number
  reportStartTime?: number
  reportUrl?: string
  validation: {
    sameEncounter: boolean
    sameDifficulty: boolean
    sameClass: boolean
    sameSpec: boolean
    hasUsablePlayerName: boolean
    hasReportCode: boolean
    hasFightId: boolean
    hasUsableExportTarget: boolean
  }
  score: number
  warnings: string[]
}

export type BenchmarkCandidateGroup = {
  baseline: BenchmarkBaseline
  candidates: NormalizedBenchmarkCandidate[]
  selectedCandidate?: NormalizedBenchmarkCandidate
  warnings: string[]
  apiSupported: boolean
}

export type BenchmarkCandidatesResponse = {
  groups: BenchmarkCandidateGroup[]
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Job model
// ---------------------------------------------------------------------------

export type PlayerAnalysisJobStatus = 'queued' | 'running' | 'complete' | 'partial' | 'failed'

export type PlayerAnalysisWarningGroupKey =
  | 'dataQuality'
  | 'benchmark'
  | 'viewFetch'
  | 'candidateSkip'
  | 'runtimeApi'

export type PlayerAnalysisWarningGroups = Partial<Record<PlayerAnalysisWarningGroupKey, string[]>>

export type PlayerAnalysisBenchmarkSkippedCandidate = {
  reason: string
  benchmarkPlayerName?: string
  benchmarkReportCode?: string
  benchmarkFightId?: number
  baselineReportCode?: string
  baselineFightId?: number
}

export type PlayerAnalysisBenchmarkSummary = {
  requested: boolean
  included: boolean
  mode: 'auto' | 'manual' | 'none'
  selectedCount: number
  exportedCount: number
  skippedCount: number
  skippedCandidates: PlayerAnalysisBenchmarkSkippedCandidate[]
  omittedReason?: string | null
}

export type PlayerAnalysisViewSkip = {
  subjectType: 'player' | 'benchmark'
  view: PlayerAnalysisExportView
  reportCode?: string
  fightId?: number
  reason: string
}

export type PlayerAnalysisViewTruncation = {
  subjectType: 'player' | 'benchmark'
  view: PlayerAnalysisExportView
  reportCode: string
  fightId: number
  rowLimit: number
  context?: string
}

export type PlayerAnalysisViewSummary = {
  selectedViews: PlayerAnalysisExportView[]
  exportedViews: PlayerAnalysisExportView[]
  skippedViews: PlayerAnalysisViewSkip[]
  truncatedViews: PlayerAnalysisViewTruncation[]
}

export type PlayerAnalysisExportJob = {
  exportId: string
  status: PlayerAnalysisJobStatus
  currentStep: string
  currentPlayerName?: string
  currentView?: PlayerAnalysisExportView
  currentReportCode?: string
  currentFightId?: number
  completedSteps: number
  totalSteps: number
  percentComplete: number
  warnings: string[]
  errors: string[]
  warningGroups: PlayerAnalysisWarningGroups
  benchmarkSummary?: PlayerAnalysisBenchmarkSummary
  viewSummary?: PlayerAnalysisViewSummary
  files?: PlayerAnalysisExportFile[]
  error?: string
  createdAt: string
  updatedAt: string
}

export type PlayerAnalysisExportStartResponse = {
  exportId: string
  status: 'queued'
  statusUrl: string
}
