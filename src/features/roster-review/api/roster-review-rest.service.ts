import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type {
  RosterEvidenceJob,
  RosterEvidenceRequest,
  RosterEvidenceStartResponse,
  RosterRaidReportsResponse,
} from '../types/roster-review.types'

const buildReportsUrl = (context: AppSettingsRequestContext): string => {
  const params = new URLSearchParams({ wclSite: context.wclSite })
  if (context.guildId) params.set('guildId', context.guildId)
  if (context.region) params.set('region', context.region)
  return apiUrl(`/api/roster-review/reports?${params.toString()}`)
}

export const RosterReviewRestService = {
  listRaidReports: (context: AppSettingsRequestContext): Promise<RosterRaidReportsResponse> =>
    apiFetch(buildReportsUrl(context)),

  startEvidenceJob: (
    request: RosterEvidenceRequest,
    context: AppSettingsRequestContext
  ): Promise<RosterEvidenceStartResponse> =>
    apiFetch(apiUrl('/api/roster-review/evidence'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...request, wclContext: context }),
    }),

  getEvidenceJob: (jobId: string): Promise<RosterEvidenceJob> =>
    apiFetch(apiUrl(`/api/roster-review/evidence/${encodeURIComponent(jobId)}`)),
}
