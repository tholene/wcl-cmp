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
  zoneId?: number | null
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
  zoneId?: number | null
  zoneName?: string | null
  ownerName?: string | null
  visibility?: string | null
  fights: WclFightSummary[]
  url: string
}

export type WclRecentPlayer = {
  name: string
  className?: string | null
  specName?: string | null
  role?: 'tank' | 'healer' | 'dps' | 'unknown'
  seenInReportCodes: string[]
  lastSeenAt?: number | null
  seenInRaidKillReports?: number
  seenInRaidKillFights?: number
}
