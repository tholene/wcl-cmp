import type { WclRequestContext } from '../warcraft-logs/wcl-request-context'

export type MechanicAuditScope =
  | {
      mode: 'dateRange'
      since: number
      until: number
    }
  | {
      mode: 'manualReports'
      reportCodes: string[]
    }

export type MechanicAuditEncounter = {
  encounterId: number
  encounterName?: string
  difficulty: number
}

/** WCL event dataType usable as independent evidence a mechanic occurred (cast/begincast events share the Casts dataType, distinguished by event.type). */
export type MechanicAuditOccurrenceEventType = 'Casts' | 'Debuffs' | 'Buffs'

export type MechanicAuditMechanic = {
  key: string
  label: string
  /** Ability IDs that produce damage-taken events for this mechanic. Kept as the canonical field for back-compat. */
  abilityIds: number[]
  dedupeWindowMs?: number
  /**
   * Ability IDs that independently confirm the mechanic occurred (e.g. the boss cast/debuff),
   * regardless of whether anyone was hit. When set, occurrence is derived from these events
   * instead of damage-taken events, so a clean dodge doesn't get reported as "did not occur."
   */
  occurrenceAbilityIds?: number[]
  /** Required when occurrenceAbilityIds is set: which WCL event dataType to query them against. */
  occurrenceEventType?: MechanicAuditOccurrenceEventType
}

/**
 * How to resolve a fight where the configured phase transition can't be found. Defaults to
 * `exclude` (the prior, exclusion-only behavior) when omitted, so existing requests keep working.
 * `fightEndForWipes`/`markerAbilityThenFightEndForWipes` must be an explicit, visible choice —
 * never a hidden default applied elsewhere in the pipeline.
 */
export type MechanicAuditNoTransitionFallback =
  | { mode: 'exclude' }
  | { mode: 'fightEndForWipes' }
  | { mode: 'markerAbilityThenFightEndForWipes'; abilityIds: number[] }

export type MechanicAuditPhaseOneBoundary =
  | {
      mode: 'phaseTransition'
      phase: number
      noTransitionFallback?: MechanicAuditNoTransitionFallback
    }
  | {
      mode: 'markerAbility'
      abilityIds: number[]
    }
  | {
      mode: 'fightRelativeTimestamp'
      endTimeMs: number
    }

export type MechanicAuditThresholds = {
  minimumEligiblePulls: number
  minimumRaidNightsWithFailure: number
  guildAverageMultiplier: number
  minimumAbsoluteRateDelta: number
}

export type MechanicAuditRequest = {
  scope: MechanicAuditScope
  encounter: MechanicAuditEncounter
  mechanics: MechanicAuditMechanic[]
  phaseOneBoundary: MechanicAuditPhaseOneBoundary
  timezone?: string
  thresholds?: Partial<MechanicAuditThresholds>
  wclContext?: WclRequestContext
}

export const MECHANIC_AUDIT_DEFAULT_TIMEZONE = 'Europe/Stockholm'

export const MECHANIC_AUDIT_DEFAULT_DEDUPE_WINDOW_MS = 750

export const MECHANIC_AUDIT_DEFAULT_NO_TRANSITION_FALLBACK: MechanicAuditNoTransitionFallback = {
  mode: 'exclude',
}

export const MECHANIC_AUDIT_DEFAULT_THRESHOLDS: MechanicAuditThresholds = {
  minimumEligiblePulls: 15,
  minimumRaidNightsWithFailure: 3,
  guildAverageMultiplier: 1.5,
  minimumAbsoluteRateDelta: 0.05,
}

export type MechanicHit = {
  raidDate: string
  reportCode: string
  reportTitle: string
  fightId: number
  pullNumber: number
  encounterId: number
  encounterName: string
  difficulty: number
  kill: boolean
  bossPercentage?: number | null
  fightRelativeTimestampMs: number
  phase: 1
  playerId: number
  playerName: string
  playerClass?: string | null
  mechanicKey: string
  mechanicLabel: string
  abilityId: number
  abilityName: string
  amount?: number | null
  absorbed?: number | null
  overkill?: number | null
  diedWithin5Seconds: boolean
  rawEventCount: number
}

export type MechanicAuditPhaseBoundarySource =
  | 'phaseTransition'
  | 'fightEndBeforePhaseTransition'
  | 'markerAbility'
  | 'markerAbilityFallback'
  | 'fightRelativeTimestamp'
  | 'unresolved'

export type MechanicAuditFightRecord = {
  reportCode: string
  reportTitle: string
  reportStartTime: number
  fightId: number
  pullNumber: number
  encounterId: number
  encounterName: string
  difficulty: number
  kill: boolean
  fightStartTime: number
  fightEndTime: number
  durationMs: number
  bossPercentage?: number | null
  friendlyPlayerIds: number[]
  /** Report-relative ms (same scale as fightStartTime/reportStartTime). Internal only — never export directly. */
  phaseOneEndReportRelativeMs: number | null
  /** Fight-relative ms, 0 <= x <= durationMs. This is the value that must be exported. */
  phaseOneEndFightRelativeMs: number | null
  phaseBoundarySource: MechanicAuditPhaseBoundarySource
  /** Set when the boundary was resolved via a fallback or couldn't be resolved at all — a low-severity diagnostic, not necessarily an exclusion. */
  phaseBoundaryWarning?: string
  isDuplicate: boolean
  duplicateGroupId?: string
  canonicalReportCode?: string
  duplicateReportCodes?: string[]
  deduplicationConfidence?: 'high' | 'medium' | 'low'
}

export type MechanicAuditPlayerInfo = {
  playerId: number
  playerName: string
  playerClass?: string | null
}

export type MechanicAuditPlayerMechanicSummary = {
  playerName: string
  playerClass?: string | null
  mechanicKey: string
  mechanicLabel: string
  eligiblePulls: number
  hitPulls: number
  deduplicatedHitOccurrences: number
  hitPullRate: number
  raidNightsPresent: number
  raidNightsWithFailure: number
  last30EligiblePulls: number
  last30HitPulls: number
  last30HitPullRate: number
  guildAverageHitPullRate: number
  playerRateMinusGuildAverage: number
  playerRateDividedByGuildAverage: number
  reviewCandidate: boolean
}

export type MechanicOccurrenceQuality = 'verified' | 'approximateFromDamage'

export type MechanicAuditPullMechanicSummary = {
  raidDate: string
  reportCode: string
  fightId: number
  pullNumber: number
  kill: boolean
  bossPercentage?: number | null
  fightDurationMs: number
  /** Fight-relative ms, 0 <= phaseOneEndMs <= fightDurationMs. Column name is stable across revisions. */
  phaseOneEndMs: number | null
  phaseBoundarySource: MechanicAuditFightRecord['phaseBoundarySource']
  mechanicKey: string
  mechanicLabel: string
  mechanicOccurred: boolean
  /** 'approximateFromDamage' means occurrence was inferred from hits (no independent occurrence evidence configured) — treat zero-hit pulls conservatively. */
  mechanicOccurrenceQuality: MechanicOccurrenceQuality
  eligiblePlayerCount: number
  uniquePlayersHit: number
  deduplicatedHitOccurrences: number
  firstHitTimestampMs: number | null
  playersHit: string[]
  isDuplicate: boolean
  duplicateGroupId?: string
  canonicalReportCode?: string
}

export type MechanicDistributionClassification = 'concentrated' | 'mixed' | 'distributed' | 'insufficientData'

export type MechanicAuditMechanicSummary = {
  mechanicKey: string
  mechanicLabel: string
  totalHitPulls: number
  playersEligible: number
  playersWithAtLeastOneHit: number
  shareOfEligiblePlayersWithHit: number
  topThreePlayersHitShare: number
  guildAverageHitPullRate: number
  medianPlayerHitPullRate: number
  reviewCandidateCount: number
  classification: MechanicDistributionClassification
  summaryText: string
  /** Fights whose report/encounter/difficulty matched scope, before any boundary/dedup exclusion. */
  matchedFights: number
  /** Fights actually usable for this mechanic's aggregation (boundary resolved, not a duplicate). */
  includedFights: number
  excludedFights: number
  includedFightPercent: number
  /** Share of includedFights that produced at least one eligible player for this mechanic. */
  eligiblePullCoverage: number
  /** Set when the classification or review-candidate evaluation was skipped/limited due to low sample size. */
  reviewCandidateEvaluationNote?: string
}

export type MechanicAuditWarningCategory =
  | 'missingPhaseTransition'
  | 'missingParticipation'
  | 'eventFetchFailure'
  | 'duplicatePull'
  | 'timestampInvariant'
  | 'truncation'
  | 'other'

export type MechanicAuditWarning = {
  message: string
  reportCode?: string
  fightId?: number
  category?: MechanicAuditWarningCategory
}

export type MechanicAuditPreviewResponse = {
  reportsScanned: number
  reportsMatched: number
  fightsScanned: number
  fightsMatched: number
  estimatedPullCount: number
  raidDateRange: { earliest: string | null; latest: string | null }
  encounter: MechanicAuditEncounter
  difficulty: number
  mechanics: Array<{ key: string; label: string; abilityIds: number[]; observedInSample?: boolean }>
  phaseBoundaryMode: MechanicAuditPhaseOneBoundary['mode']
  warnings: string[]
}

export type MechanicAuditJobStatus = 'queued' | 'running' | 'complete' | 'partial' | 'failed'

export type MechanicAuditExportFile = {
  filename: string
  sizeBytes: number
  rowCount?: number
}

export type MechanicAuditExcludedFightCategorySummary = {
  category: MechanicAuditWarningCategory
  count: number
}

export type MechanicAuditExportResultSummary = {
  reportsScanned: number
  reportsIncluded: number
  fightsScanned: number
  fightsIncluded: number
  fightsExcluded: Array<{
    reportCode: string
    fightId: number
    reason: string
    category: MechanicAuditWarningCategory
  }>
  /** Same data as fightsExcluded, grouped by category with counts — for UI/README, so hundreds of near-identical warnings don't get emitted individually. Full per-fight detail stays in manifest.json via fightsExcluded. */
  excludedFightCategorySummary: MechanicAuditExcludedFightCategorySummary[]
  duplicateFightsExcluded: number
  duplicateGroupCount: number
  rawEventCount: number
  deduplicatedEventCount: number
  truncated: boolean
}

export type MechanicAuditJob = {
  auditId: string
  status: MechanicAuditJobStatus
  currentStep: string
  completedSteps: number
  totalSteps: number
  percentComplete: number
  warnings: string[]
  errors: string[]
  createdAt: string
  updatedAt: string
  files?: MechanicAuditExportFile[]
  resultSummary?: MechanicAuditExportResultSummary
  error?: string
}

export type MechanicAuditExportStartResponse = {
  auditId: string
  status: 'queued'
  statusUrl: string
}
