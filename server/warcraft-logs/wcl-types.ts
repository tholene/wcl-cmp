export type WclGraphQlResponse<TData> = {
  data?: TData
  errors?: Array<{
    message: string
  }>
}

export type WclReportSummary = {
  code: string
  title: string
  startTime: number
  endTime: number
  visibility?: string | null
  ownerName?: string | null
  zoneName?: string | null
  url: string
}

export type WclFightSummary = {
  id: number
  encounterId: number
  encounterName: string
  kill: boolean
  difficulty: number
  startTime: number
  endTime: number
}

export type WclReportDetails = {
  code: string
  title: string
  startTime: number
  endTime: number
  zoneName?: string | null
  ownerName?: string | null
  visibility?: string | null
  fights: WclFightSummary[]
  url: string
}

export type WclBossSummary = {
  encounterId: number
  encounterName: string
  pullCount: number
  killCount: number
  wipeCount: number
  lastSeenAt: number
  difficulties: number[]
  recentReports: Array<{
    code: string
    title: string
    startTime: number
  }>
}

export type WclRecentBossesResponse = {
  generatedAt: number
  source: {
    reportCount: number
    note: string
  }
  bosses: WclBossSummary[]
}

export type WclBossFightListItem = {
  reportCode: string
  reportTitle: string
  reportStartTime: number
  fightId: number
  encounterId: number
  encounterName: string
  kill: boolean
  difficulty: number
  startTime: number
  endTime: number
  durationMs: number
  url: string
}

export type WclRecentBossFightsResponse = {
  generatedAt: number
  source: {
    reportCount: number
    note: string
  }
  boss: {
    encounterId: number
    encounterName: string
  }
  fights: WclBossFightListItem[]
}


export type WclFightParticipant = {
  id: number
  name: string
  type?: string | null
  className?: string | null
  icon?: string | null
}

export type WclFightDamageEvent = {
  timestampRelativeMs: number
  abilityId?: number | null
  abilityName: string
  sourceName?: string | null
  amount?: number | null
}

export type WclFightDeathSummary = {
  playerId: number
  playerName: string
  className?: string | null
  deathTime: number
  deathTimestampRelativeMs: number
  finalDamageEvent?: WclFightDamageEvent
  recentDamageEvents: WclFightDamageEvent[]
}

export type WclFightReview = {
  reportCode: string
  reportTitle: string
  reportUrl: string
  fightId: number
  encounterId: number
  encounterName: string
  kill: boolean
  difficulty: number
  startTime: number
  endTime: number
  durationMs: number
  participants: WclFightParticipant[]
  deaths: WclFightDeathSummary[]
  source: {
    note: string
    partial: boolean
  }
}

export type WclPlayerReviewEvent = {
  timestampRelativeMs: number
  eventType: string
  abilityId?: number | null
  abilityName: string
  sourceName?: string | null
  targetName?: string | null
  amount?: number | null
}

export type WclPlayerReviewFinding = {
  id: string
  category: 'context' | 'output' | 'execution' | 'survivability' | 'utility' | 'consistency' | 'confidence'
  severity: 'info' | 'warning' | 'critical'
  confidence: 'low' | 'medium' | 'high'
  title: string
  summary: string
  evidence: WclPlayerReviewEvent[]
  limitation?: string
}

export type WclPlayerReviewCategoryEvidence = {
  summary: string
  confidence: 'low' | 'medium' | 'high'
  limitations: string[]
}

export type WclPlayerFightReview = {
  reportCode: string
  reportTitle: string
  reportUrl: string
  fight: {
    id: number
    encounterId: number
    encounterName: string
    kill: boolean
    difficulty: number
    startTime: number
    endTime: number
    durationMs: number
  }
  player: {
    id: number
    name: string
    type?: string | null
    className?: string | null
    icon?: string | null
  }
  assignmentContext: {
    status: 'Unknown'
    note: string
  }
  evidence: {
    context: WclPlayerReviewCategoryEvidence
    output: WclPlayerReviewCategoryEvidence & {
      damageDoneEvents: WclPlayerReviewEvent[]
      totalDamageDone: number
    }
    execution: WclPlayerReviewCategoryEvidence & {
      openerEvents: WclPlayerReviewEvent[]
      casts: WclPlayerReviewEvent[]
      castCount: number
      castsPerMinute: number
      longNoCastGapsMs: number[]
    }
    survivability: WclPlayerReviewCategoryEvidence & {
      deaths: WclFightDeathSummary[]
      damageTakenEvents: WclPlayerReviewEvent[]
      defensiveEvents: WclPlayerReviewEvent[]
      consumableEvents: WclPlayerReviewEvent[]
    }
    utility: WclPlayerReviewCategoryEvidence & {
      interrupts: WclPlayerReviewEvent[]
      dispels: WclPlayerReviewEvent[]
    }
    consistency: WclPlayerReviewCategoryEvidence
    confidence: WclPlayerReviewCategoryEvidence
  }
  topFindings: WclPlayerReviewFinding[]
  source: {
    note: string
    partial: boolean
    limitations: string[]
  }
}

export type WclRecentPlayer = {
  name: string
  className?: string | null
  specName?: string | null
  role?: 'tank' | 'healer' | 'dps' | 'unknown'
  seenInReportCodes: string[]
  lastSeenAt?: number | null
}

export type WclPlayerReviewScopePreset =
  | 'last-7-days'
  | 'previous-calendar-week'
  | 'last-2-weeks'
  | 'manual-reports'

export type WclPlayerReviewRoleMetadata = {
  role: 'tank' | 'healer' | 'dps' | 'unknown'
  specName?: string
  className?: string
  source: 'wcl' | 'configured' | 'unknown'
  confidence: 'high' | 'medium' | 'low' | 'unknown'
  warnings: string[]
}

export type WclPlayerReviewScopeSummary = {
  requestedPlayerName: string
  scopePreset?: WclPlayerReviewScopePreset
  since?: number
  until?: number
  onlyPlayerPresent: boolean
  reportsScanned: number
  reportsIncluded: number
  fightsScanned: number
  fightsIncluded: number
  fightsSkippedBecausePlayerAbsent: number
  fightsSkippedByDate: number
  fightsSkippedByKillWipeFilter: number
  payloadLimitsApplied: string[]
  warnings: string[]
}

export type WclPlayerReviewScopePreviewRequest = {
  playerName: string
  scopePreset?: WclPlayerReviewScopePreset
  since?: number
  until?: number
  reportCodes?: string[]
  includeKills?: boolean
  includeWipes?: boolean
  includeTrash?: boolean
  onlyPlayerPresent?: boolean
  maxReports?: number
  maxFights?: number
}

export type WclPlayerReviewScopePreview = {
  playerName: string
  scopePreset?: WclPlayerReviewScopePreset
  since?: number
  until?: number
  reportsScanned: number
  reportsIncluded: number
  fightsScanned: number
  fightsIncluded: number
  fightsSkippedBecausePlayerAbsent: number
  fightsSkippedByDate: number
  fightsSkippedByKillWipeFilter: number
  estimatedPayloadLevel: 'small' | 'medium' | 'large'
  roleInference: WclPlayerReviewRoleMetadata
  includedReports: Array<{
    code: string
    title: string
    startTime: number
    url: string
    playerPresent: boolean
    includedFightIds: number[]
    skippedFightIds: number[]
    warnings: string[]
  }>
  warnings: string[]
}

export type WclPlayerReviewSnapshotRequest = {
  playerName: string
  scopePreset?: WclPlayerReviewScopePreset
  since?: number
  until?: number
  reportCodes?: string[]
  fightIdsByReport?: Record<string, number[]>
  includeKills?: boolean
  includeWipes?: boolean
  includeTrash?: boolean
  onlyPlayerPresent?: boolean
  maxReports?: number
  maxFights?: number
  maxDeathsPerFight?: number
  maxEventsBeforeDeath?: number
  maxDamageTakenAbilities?: number
  maxCasts?: number
  maxBuffs?: number
}

export type WclPlayerReviewSnapshot = {
  player: {
    name: string
    className?: string | null
    specName?: string | null
    role?: 'tank' | 'healer' | 'dps' | 'unknown'
    possibleActorIds: Array<{
      reportCode: string
      actorId: number
    }>
  }
  roleMetadata: WclPlayerReviewRoleMetadata
  scopeSummary: WclPlayerReviewScopeSummary
  reports: Array<{
    code: string
    title: string
    url: string
    startTime: number
  }>
  fights: WclPlayerFightSnapshot[]
  aggregate: {
    pullsReviewed: number
    killsReviewed: number
    wipesReviewed: number
    deaths: number
    earlyDeaths: number
    averageDps?: number | null
    averageHps?: number | null
    majorDamageTakenAbilities: Array<{
      abilityName: string
      count: number
      total: number
    }>
    defensiveUses: Array<{
      abilityName: string
      count: number
    }>
    interruptCount?: number | null
    dispelCount?: number | null
  }
  warnings: string[]
}

export type WclPlayerFightSnapshot = {
  reportCode: string
  reportUrl: string
  fightId: number
  encounterId: number
  encounterName: string
  kill: boolean
  difficulty: number
  durationMs: number
  playerPresent: boolean
  playerDied: boolean
  deathTimeMs?: number | null
  throughput?: {
    damageDone?: number | null
    dps?: number | null
    healingDone?: number | null
    hps?: number | null
    activeTimePercent?: number | null
  }
  damageTaken: Array<{
    abilityName: string
    total: number
    hits: number
  }>
  deaths: Array<{
    timestampMs: number
    killingBlow?: string | null
    lastDamageEvents: Array<{
      secondsBeforeDeath: number
      abilityName: string
      amount: number
      sourceName?: string | null
    }>
    healingReceivedBeforeDeath: Array<{
      secondsBeforeDeath: number
      abilityName: string
      amount: number
      sourceName?: string | null
    }>
    defensiveBuffsActive?: string[]
  }>
  casts: Array<{
    abilityName: string
    count: number
  }>
  buffs: Array<{
    abilityName: string
    uptimePercent?: number | null
    applications?: number | null
  }>
  notes: string[]
  warnings: string[]
}
