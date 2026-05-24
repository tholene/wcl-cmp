import { PlayerAnalysisRestService } from '../api/player-analysis-rest.service'
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

export const PlayerAnalysisService = {
  getExportPreview: async (
    request: PlayerAnalysisExportRequest,
    context: AppSettingsRequestContext
  ): Promise<PlayerAnalysisExportPreview> => PlayerAnalysisRestService.getExportPreview(request, context),

  startExport: async (
    request: PlayerAnalysisExportRequest,
    context: AppSettingsRequestContext
  ): Promise<PlayerAnalysisExportStartResponse> => PlayerAnalysisRestService.startExport(request, context),

  getExportStatus: async (exportId: string): Promise<PlayerAnalysisExportJob> =>
    PlayerAnalysisRestService.getExportStatus(exportId),

  getBenchmarkCandidates: async (
    request: BenchmarkCandidatesRequest,
    context: AppSettingsRequestContext
  ): Promise<BenchmarkCandidatesResponse> => PlayerAnalysisRestService.getBenchmarkCandidates(request, context),

  getRecentPlayers: async (context: AppSettingsRequestContext): Promise<RecentPlayersResponse> =>
    PlayerAnalysisRestService.getRecentPlayers(context),
}
