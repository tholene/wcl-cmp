import { ReportsRestService } from '../api/reports-rest.service'
import type { RecentReportsResponse } from '../types/recent-reports-response'

export const ReportsService = {
  listRecentReports: async (): Promise<RecentReportsResponse> => ReportsRestService.listRecentReports(),
}
