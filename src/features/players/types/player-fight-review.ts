export type PlayerReviewEvent = {
  timestampRelativeMs: number
  eventType: string
  abilityId?: number | null
  abilityName: string
  abilityIcon?: string | null
  sourceName?: string | null
  targetName?: string | null
  amount?: number | null
}

export type PlayerReviewFinding = {
  id: string
  category: 'context' | 'output' | 'execution' | 'survivability' | 'utility' | 'consistency' | 'confidence'
  severity: 'info' | 'warning' | 'critical'
  confidence: 'low' | 'medium' | 'high'
  title: string
  summary: string
  evidence: PlayerReviewEvent[]
  limitation?: string
}

export type PlayerReviewCategoryEvidence = {
  summary: string
  confidence: 'low' | 'medium' | 'high'
  limitations: string[]
}

export type PlayerFightDeathSummary = {
  playerId: number
  playerName: string
  className?: string | null
  deathTime: number
  deathTimestampRelativeMs: number
  finalDamageEvent?: {
    timestampRelativeMs: number
    abilityId?: number | null
    abilityName: string
    abilityIcon?: string | null
    sourceName?: string | null
    amount?: number | null
  }
  recentDamageEvents: Array<{
    timestampRelativeMs: number
    abilityId?: number | null
    abilityName: string
    abilityIcon?: string | null
    sourceName?: string | null
    amount?: number | null
  }>
}

export type PlayerFightReview = {
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
    context: PlayerReviewCategoryEvidence
    output: PlayerReviewCategoryEvidence & {
      damageDoneEvents: PlayerReviewEvent[]
      totalDamageDone: number
    }
    execution: PlayerReviewCategoryEvidence & {
      openerEvents: PlayerReviewEvent[]
      casts: PlayerReviewEvent[]
      castCount: number
      castsPerMinute: number
      longNoCastGapsMs: number[]
    }
    survivability: PlayerReviewCategoryEvidence & {
      deaths: PlayerFightDeathSummary[]
      damageTakenEvents: PlayerReviewEvent[]
      defensiveEvents: PlayerReviewEvent[]
      consumableEvents: PlayerReviewEvent[]
    }
    utility: PlayerReviewCategoryEvidence & {
      interrupts: PlayerReviewEvent[]
      dispels: PlayerReviewEvent[]
    }
    consistency: PlayerReviewCategoryEvidence
    confidence: PlayerReviewCategoryEvidence
  }
  topFindings: PlayerReviewFinding[]
  source: {
    note: string
    partial: boolean
    limitations: string[]
  }
}