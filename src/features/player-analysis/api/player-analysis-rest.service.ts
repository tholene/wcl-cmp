import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'
import type {
  PlayerAnalysisExportJob,
  PlayerAnalysisExportPreview,
  PlayerAnalysisExportRequest,
  PlayerAnalysisExportStartResponse,
  BenchmarkCandidatesRequest,
  BenchmarkCandidatesResponse,
} from '../types/player-analysis.types'

export const PlayerAnalysisRestService = {
  getExportPreview: (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportPreview> =>
    apiFetch(apiUrl('/api/player-analysis/export-preview'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }),

  startExport: (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportStartResponse> =>
    apiFetch(apiUrl('/api/player-analysis/export'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }),

  getExportStatus: (exportId: string): Promise<PlayerAnalysisExportJob> =>
    apiFetch(apiUrl(`/api/player-analysis/exports/${exportId}/status`)),

  getBenchmarkCandidates: (request: BenchmarkCandidatesRequest): Promise<BenchmarkCandidatesResponse> =>
    apiFetch(apiUrl('/api/player-analysis/benchmark-candidates'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }),
}
