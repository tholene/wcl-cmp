import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type { RecentReportsResponse } from '../types/recent-reports-response'

const buildRecentReportsUrl = (context: AppSettingsRequestContext): string => {
  const params = new URLSearchParams({
    wclSite: context.wclSite,
  })
  if (context.guildId) params.set('guildId', context.guildId)
  if (context.region) params.set('region', context.region)
  return apiUrl(`/api/reports/recent?${params.toString()}`)
}

export const ReportsRestService = {
  listRecentReports: (context: AppSettingsRequestContext): Promise<RecentReportsResponse> =>
    apiFetch(buildRecentReportsUrl(context)),
}
