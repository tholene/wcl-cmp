import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'
import type { ReportDetails } from '../types/report-details'
import type { RecentReportsResponse } from '../types/recent-reports-response'

export const ReportsRestService = {
  listRecentReports: (): Promise<RecentReportsResponse> =>
    apiFetch(apiUrl('/api/reports/recent')),

  getReportDetails: (code: string): Promise<ReportDetails> =>
    apiFetch(apiUrl(`/api/reports/${code}`)),
}
