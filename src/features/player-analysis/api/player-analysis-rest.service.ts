import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import type {
  PlayerAnalysisExportJob,
  PlayerAnalysisExportPreview,
  PlayerAnalysisExportRequest,
  PlayerAnalysisExportStartResponse,
  BenchmarkCandidatesRequest,
  BenchmarkCandidatesResponse,
  RecentPlayersResponse,
} from '../types/player-analysis.types'

const withWclContext = <TRequest extends object>(
  request: TRequest,
  context: AppSettingsRequestContext
): TRequest & { wclContext: AppSettingsRequestContext } => ({
  ...request,
  wclContext: context,
})

const buildRecentPlayersUrl = (context: AppSettingsRequestContext): string => {
  const params = new URLSearchParams({
    wclSite: context.wclSite,
  })
  if (context.guildId) params.set('guildId', context.guildId)
  if (context.region) params.set('region', context.region)
  return apiUrl(`/api/players/recent?${params.toString()}`)
}

export const PlayerAnalysisRestService = {
  getExportPreview: (
    request: PlayerAnalysisExportRequest,
    context: AppSettingsRequestContext
  ): Promise<PlayerAnalysisExportPreview> =>
    apiFetch(apiUrl('/api/player-analysis/export-preview'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withWclContext(request, context)),
    }),

  startExport: (
    request: PlayerAnalysisExportRequest,
    context: AppSettingsRequestContext
  ): Promise<PlayerAnalysisExportStartResponse> =>
    apiFetch(apiUrl('/api/player-analysis/export'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withWclContext(request, context)),
    }),

  getExportStatus: (exportId: string): Promise<PlayerAnalysisExportJob> =>
    apiFetch(apiUrl(`/api/player-analysis/exports/${exportId}/status`)),

  getBenchmarkCandidates: (
    request: BenchmarkCandidatesRequest,
    context: AppSettingsRequestContext
  ): Promise<BenchmarkCandidatesResponse> =>
    apiFetch(apiUrl('/api/player-analysis/benchmark-candidates'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(withWclContext(request, context)),
    }),

  getRecentPlayers: (context: AppSettingsRequestContext): Promise<RecentPlayersResponse> =>
    apiFetch(buildRecentPlayersUrl(context)),
}
