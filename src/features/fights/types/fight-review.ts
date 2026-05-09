export type FightParticipant = {
  id: number
  name: string
  type?: string | null
  className?: string | null
  icon?: string | null
}

export type FightDamageEvent = {
  timestampRelativeMs: number
  abilityId?: number | null
  abilityName: string
  sourceName?: string | null
  amount?: number | null
}

export type FightDeathSummary = {
  playerId: number
  playerName: string
  className?: string | null
  deathTime: number
  deathTimestampRelativeMs: number
  finalDamageEvent?: FightDamageEvent
  recentDamageEvents: FightDamageEvent[]
}

export type FightReview = {
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
  participants: FightParticipant[]
  deaths: FightDeathSummary[]
  source: {
    note: string
    partial: boolean
  }
}