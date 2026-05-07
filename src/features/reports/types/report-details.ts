import type { ReportFightSummary } from './report-fight-summary'

export type ReportDetails = {
  code: string
  title: string
  startTime: number
  endTime: number
  zoneName?: string | null
  ownerName?: string | null
  visibility?: string | null
  fights: ReportFightSummary[]
  url: string
}
