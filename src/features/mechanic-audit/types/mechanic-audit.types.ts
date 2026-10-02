import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'

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

export type MechanicAuditOccurrenceEventType = 'Casts' | 'Debuffs' | 'Buffs'

export type MechanicAuditMechanic = {
  key: string
  label: string
  abilityIds: number[]
  dedupeWindowMs?: number
  occurrenceAbilityIds?: number[]
  occurrenceEventType?: MechanicAuditOccurrenceEventType
}

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

export const MECHANIC_AUDIT_DEFAULT_TIMEZONE = 'Europe/Stockholm'

export const MECHANIC_AUDIT_DEFAULT_DEDUPE_WINDOW_MS = 750

export const MECHANIC_AUDIT_DEFAULT_THRESHOLDS: MechanicAuditThresholds = {
  minimumEligiblePulls: 15,
  minimumRaidNightsWithFailure: 3,
  guildAverageMultiplier: 1.5,
  minimumAbsoluteRateDelta: 0.05,
}

export type MechanicAuditRequest = {
  scope: MechanicAuditScope
  encounter: MechanicAuditEncounter
  mechanics: MechanicAuditMechanic[]
  phaseOneBoundary: MechanicAuditPhaseOneBoundary
  timezone?: string
  thresholds?: Partial<MechanicAuditThresholds>
  wclContext?: AppSettingsRequestContext
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

export type MechanicAuditWarningCategory =
  | 'missingPhaseTransition'
  | 'missingParticipation'
  | 'eventFetchFailure'
  | 'duplicatePull'
  | 'timestampInvariant'
  | 'truncation'
  | 'other'

export type MechanicAuditExcludedFightCategorySummary = {
  category: MechanicAuditWarningCategory
  count: number
}

export type MechanicAuditExportResultSummary = {
  reportsScanned: number
  reportsIncluded: number
  fightsScanned: number
  fightsIncluded: number
  fightsExcluded: Array<{ reportCode: string; fightId: number; reason: string; category: MechanicAuditWarningCategory }>
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
