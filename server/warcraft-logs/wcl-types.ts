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
