import { PlayerAnalysisRestService } from '../api/player-analysis-rest.service'
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
  getExportPreview: async (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportPreview> =>
    PlayerAnalysisRestService.getExportPreview(request),

  startExport: async (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportStartResponse> =>
    PlayerAnalysisRestService.startExport(request),

  getExportStatus: async (exportId: string): Promise<PlayerAnalysisExportJob> =>
    PlayerAnalysisRestService.getExportStatus(exportId),

  getBenchmarkCandidates: async (request: BenchmarkCandidatesRequest): Promise<BenchmarkCandidatesResponse> =>
    PlayerAnalysisRestService.getBenchmarkCandidates(request),

  getRecentPlayers: async (): Promise<RecentPlayersResponse> =>
    PlayerAnalysisRestService.getRecentPlayers(),
}
