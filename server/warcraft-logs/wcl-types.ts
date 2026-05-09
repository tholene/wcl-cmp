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
