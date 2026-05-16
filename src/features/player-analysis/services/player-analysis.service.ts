import { PlayerAnalysisRestService } from '../api/player-analysis-rest.service'
import type {
  PlayerAnalysisExportJob,
  PlayerAnalysisExportPreview,
  PlayerAnalysisExportRequest,
  PlayerAnalysisExportStartResponse,
  PlayerBenchmarkCandidatesRequest,
  BenchmarkCandidatesResponse,
} from '../types/player-analysis.types'

export const PlayerAnalysisService = {
  getExportPreview: async (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportPreview> =>
    PlayerAnalysisRestService.getExportPreview(request),

  startExport: async (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportStartResponse> =>
    PlayerAnalysisRestService.startExport(request),

  getExportStatus: async (exportId: string): Promise<PlayerAnalysisExportJob> =>
    PlayerAnalysisRestService.getExportStatus(exportId),

  getBenchmarkCandidates: async (request: PlayerBenchmarkCandidatesRequest): Promise<BenchmarkCandidatesResponse> =>
    PlayerAnalysisRestService.getBenchmarkCandidates(request),
}
