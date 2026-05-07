import type { ReportDetails } from '../types/report-details'
import type { RecentReportsResponse } from '../types/recent-reports-response'

export const ReportsRestService = {
  listRecentReports: async (): Promise<RecentReportsResponse> => {
    const response = await fetch('/api/reports/recent')

    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      throw new Error(data.error ?? 'Failed to fetch recent reports.')
    }

    return (await response.json()) as RecentReportsResponse
  },

  getReportDetails: async (code: string): Promise<ReportDetails> => {
    const response = await fetch(`/api/reports/${code}`)

    if (!response.ok) {
      const data = (await response.json()) as { error?: string }
      throw new Error(data.error ?? 'Failed to fetch report details.')
    }

    return (await response.json()) as ReportDetails
  },
}
