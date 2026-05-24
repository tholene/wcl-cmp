import { ReportsRestService } from '../api/reports-rest.service'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type { RecentReportsResponse } from '../types/recent-reports-response'

export const ReportsService = {
  listRecentReports: async (context: AppSettingsRequestContext): Promise<RecentReportsResponse> =>
    ReportsRestService.listRecentReports(context),
}
