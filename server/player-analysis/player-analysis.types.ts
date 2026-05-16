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

export type PlayerBenchmarkRequest = {
  targetPercentile: PlayerBenchmarkTargetPercentile
  requireSameClassSpec: true
  itemLevelWindow?: number
  killDurationWindowPct?: number
  preferSameTalents?: boolean
  preferSameHeroTalents?: boolean
  manualTarget?: {
    reportCode: string
    fightId: number
    playerName: string
    sourceId?: number
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
  includeBenchmark?: boolean
  benchmark?: PlayerBenchmarkRequest
  limits?: Partial<PlayerAnalysisExportLimits>
  playerContext?: PlayerUserContext
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
  warnings: string[]
}

export type PlayerBenchmarkMode = 'none' | 'manual' | 'automatic'

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

export type PlayerBenchmarkCandidatesRequest = {
  playerName: string
  reportCode: string
  fightId: number
  encounterId: number
  difficulty: number
  className: string
  specName: string
  itemLevel?: number | null
  fightDurationMs: number
  targetPercentile: 50 | 75 | 90
  itemLevelWindow?: number
  killDurationWindowPct?: number
}

// ---------------------------------------------------------------------------
// Job model
// ---------------------------------------------------------------------------

export type PlayerAnalysisJobStatus = 'queued' | 'running' | 'complete' | 'partial' | 'failed'

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
