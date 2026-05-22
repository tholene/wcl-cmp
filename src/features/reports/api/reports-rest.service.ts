import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'
import type { RecentReportsResponse } from '../types/recent-reports-response'

export const ReportsRestService = {
  listRecentReports: (): Promise<RecentReportsResponse> =>
    apiFetch(apiUrl('/api/reports/recent')),
}
