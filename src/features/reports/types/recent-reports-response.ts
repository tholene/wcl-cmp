import type { ReportSummary } from './report-summary'

export type RecentReportsResponse = {
  guildId?: string
  region?: string
  reports: ReportSummary[]
}
