import { apiUrl } from '@/lib/api-base-url'
import type { ReportDetails } from '../types/report-details'
import type { RecentReportsResponse } from '../types/recent-reports-response'

export const ReportsRestService = {
  listRecentReports: async (): Promise<RecentReportsResponse> => {
    const response = await fetch(apiUrl('/api/reports/recent'))
    const text = await response.text()
    if (!text.trim()) {
      throw new Error(
        response.status === 502 || response.status === 503
          ? 'The API server may not be running.'
          : `Server returned ${response.status} with no body.`
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Failed to fetch recent reports: invalid server response.')
    }

    if (!response.ok) {
      const data = parsed as { error?: string }
      throw new Error(data.error ?? 'Failed to fetch recent reports.')
    }

    return parsed as RecentReportsResponse
  },

  getReportDetails: async (code: string): Promise<ReportDetails> => {
    const response = await fetch(apiUrl(`/api/reports/${code}`))
    const text = await response.text()
    if (!text.trim()) {
      throw new Error(
        response.status === 502 || response.status === 503
          ? 'The API server may not be running.'
          : `Server returned ${response.status} with no body.`
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Failed to fetch report details: invalid server response.')
    }

    if (!response.ok) {
      const data = parsed as { error?: string }
      throw new Error(data.error ?? 'Failed to fetch report details.')
    }

    return parsed as ReportDetails
  },
}
