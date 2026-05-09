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
