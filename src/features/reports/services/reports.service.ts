import { ReportsRestService } from '../api/reports-rest.service'
import type { ReportDetails } from '../types/report-details'
import type { RecentReportsResponse } from '../types/recent-reports-response'

export const ReportsService = {
  listRecentReports: async (): Promise<RecentReportsResponse> => ReportsRestService.listRecentReports(),
  getReportDetails: async (code: string): Promise<ReportDetails> => ReportsRestService.getReportDetails(code),
}
