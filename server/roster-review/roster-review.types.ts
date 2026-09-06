import type { WclRequestContext } from '../player-analysis/player-analysis.types'

// ---------------------------------------------------------------------------
// Shared roster review contracts (mirrored in src/features/roster-review/types)
// ---------------------------------------------------------------------------

export type RosterRankingTimeframe = 'historical' | 'current'

export type RosterRankingRoleBucket = 'tanks' | 'healers' | 'dps'

export type RosterOverallPercentileSource = 'rankPercent' | 'derivedFromRank'

export type RosterRaidReportFight = {
  id: number
  encounterId: number
  encounterName: string
  difficulty: number
  kill: boolean
  /** Absolute epoch ms (report start + fight offset). */
  startTime: number
  durationMs: number
}

export type RosterRaidReportParticipant = {
  name: string
  className: string | null
}

export type RosterRaidReport = {
  code: string
  title: string
  url: string
  startTime: number
  endTime: number
  zoneId: number | null
  zoneName: string | null
  /** Boss fights only (encounterId > 0). */
  fights: RosterRaidReportFight[]
  /** Kill count per difficulty id (3 = Normal, 4 = Heroic, 5 = Mythic). */
  killCountsByDifficulty: Record<string, number>
  participants: RosterRaidReportParticipant[]
  warnings: string[]
}

export type RosterRaidReportsResponse = {
  reports: RosterRaidReport[]
  warnings: string[]
  generatedAt: number
}

export type RosterEvidenceRequest = {
  reportCodes: string[]
  /** Difficulty filter. null/undefined = all difficulties. */
  difficulty?: number | null
  /** Optional encounter filter. Empty/undefined = all bosses. */
  encounterIds?: number[]
  playerNames: string[]
  wclContext?: WclRequestContext
}

export type RosterFightRanking = {
  overallPercentile: number | null
  overallSource: RosterOverallPercentileSource | null
  bracketPercentile: number | null
  itemLevel: number | null
  amount: number | null
  roleBucket: RosterRankingRoleBucket
  className: string | null
  specName: string | null
  timeframe: RosterRankingTimeframe
}

export type RosterFightPresenceSource = 'fightFriendlyPlayers' | 'reportActors' | 'unknown'

export type RosterFightEvidence = {
  reportCode: string
  fightId: number
  encounterId: number
  encounterName: string
  difficulty: number
  kill: boolean
  startTime: number
  durationMs: number
  /** null = presence could not be determined. */
  present: boolean | null
  presenceSource: RosterFightPresenceSource
  /** null = no ranking row matched (hidden character, wipe, or no rankings for fight). */
  ranking: RosterFightRanking | null
  /** null = death data could not be retrieved for this fight. */
  deaths: { count: number; timesMs: number[] } | null
}

export type RosterPercentileStats = {
  latest: number | null
  median: number | null
  mean: number | null
  best: number | null
  worst: number | null
}

export type RosterItemLevelStats = {
  latest: number | null
  min: number | null
  max: number | null
}

export type RosterOutputStats = {
  latestAmount: number | null
  meanAmount: number | null
  metric: 'dps' | 'hps' | 'unknown'
}

export type RosterPlayerPerformance = {
  /** Kill fights with a matching ranking row. */
  sampleSize: number
  overall: RosterPercentileStats | null
  bracket: RosterPercentileStats | null
  itemLevel: RosterItemLevelStats | null
  output: RosterOutputStats | null
  /** Sample sizes by source of the overall percentile. */
  overallSources: Record<RosterOverallPercentileSource, number>
}

export type RosterPlayerConsistency = {
  /** best - worst of overall percentile. */
  spread: number | null
  /** best - median of overall percentile. */
  bestMinusMedian: number | null
  /** Count of overall percentiles below 50. */
  belowFiftyCount: number
  /** Count of overall percentiles at or above 75. */
  atLeastSeventyFiveCount: number
}

export type RosterPlayerExecution = {
  /** Kill fights where the player was present and death data was retrieved. */
  killFightsChecked: number
  killFightsDeathUnknown: number
  deaths: number
  fightsWithDeath: number
  /** Earliest death as a percentage of fight duration (0-100), null if no deaths. */
  earliestDeathPercentOfFight: number | null
}

export type RosterLogPresence = {
  reportsPresent: number
  reportsTotal: number
  presentReportCodes: string[]
  absentReportCodes: string[]
}

export type RosterFightPresence = {
  fightsPresent: number
  fightsTotal: number
  fightsUnknown: number
  /** Kill fights in reports where the player was logged but not in the fight. */
  satOutKillFights: number
}

export type RosterEvidenceSignalSeverity = 'info' | 'caution'

export type RosterEvidenceSignalCode =
  | 'noRankingData'
  | 'limitedSample'
  | 'bestOutlier'
  | 'highSpread'
  | 'multipleSpecs'
  | 'missingFromLogs'
  | 'satOutFights'
  | 'repeatedDeaths'
  | 'bracketAboveOverall'
  | 'overallAboveBracket'
  | 'derivedPercentile'
  | 'notFoundInLogs'

export type RosterEvidenceSignal = {
  code: RosterEvidenceSignalCode
  severity: RosterEvidenceSignalSeverity
  label: string
  detail: string
}

export type RosterPlayerEvidenceStatus = 'ok' | 'partial' | 'notFound'

export type RosterPlayerEvidence = {
  playerName: string
  resolvedName: string | null
  className: string | null
  primarySpecName: string | null
  specsSeen: string[]
  wclRole: 'tank' | 'healer' | 'dps' | 'unknown'
  status: RosterPlayerEvidenceStatus
  logPresence: RosterLogPresence
  fightPresence: RosterFightPresence
  performance: RosterPlayerPerformance
  consistency: RosterPlayerConsistency
  execution: RosterPlayerExecution
  signals: RosterEvidenceSignal[]
  fights: RosterFightEvidence[]
  warnings: string[]
}

export type RosterEvidenceReportSummary = {
  code: string
  title: string
  url: string
  startTime: number
  fightsConsidered: number
  killFightsConsidered: number
  loaded: boolean
}

export type RosterEvidenceResult = {
  reportCodes: string[]
  difficulty: number | null
  encounterIds: number[]
  reports: RosterEvidenceReportSummary[]
  players: RosterPlayerEvidence[]
  warnings: string[]
  generatedAt: number
}

export type RosterEvidenceJobStatus = 'queued' | 'running' | 'complete' | 'partial' | 'failed'

export type RosterEvidenceJob = {
  jobId: string
  status: RosterEvidenceJobStatus
  currentStep: string
  completedSteps: number
  totalSteps: number
  percentComplete: number
  warnings: string[]
  error?: string
  result?: RosterEvidenceResult
  createdAt: string
  updatedAt: string
}

export type RosterEvidenceStartResponse = {
  jobId: string
  status: 'queued'
  statusUrl: string
}
