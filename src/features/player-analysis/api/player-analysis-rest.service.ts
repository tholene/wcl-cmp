import type { ApiErrorResponse } from '@/features/reports/types/api-error-response'
import type {
  PlayerAnalysisExportJob,
  PlayerAnalysisExportPreview,
  PlayerAnalysisExportRequest,
  PlayerAnalysisExportStartResponse,
  PlayerBenchmarkCandidatesRequest,
  PlayerBenchmarkCandidate,
} from '../types/player-analysis.types'

export const PlayerAnalysisRestService = {
  getExportPreview: async (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportPreview> => {
    const response = await fetch('/api/player-analysis/export-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const data = (await response.json()) as ApiErrorResponse
      throw new Error(data.error ?? 'Failed to preview export scope.')
    }
    return (await response.json()) as PlayerAnalysisExportPreview
  },

  startExport: async (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportStartResponse> => {
    const response = await fetch('/api/player-analysis/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const data = (await response.json()) as ApiErrorResponse
      throw new Error(data.error ?? 'Failed to start export job.')
    }
    return (await response.json()) as PlayerAnalysisExportStartResponse
  },

  getExportStatus: async (exportId: string): Promise<PlayerAnalysisExportJob> => {
    const response = await fetch(`/api/player-analysis/exports/${exportId}/status`)
    if (!response.ok) {
      const data = (await response.json()) as ApiErrorResponse
      throw new Error(data.error ?? 'Failed to fetch export status.')
    }
    return (await response.json()) as PlayerAnalysisExportJob
  },

  getBenchmarkCandidates: async (
    request: PlayerBenchmarkCandidatesRequest
  ): Promise<{ candidates: PlayerBenchmarkCandidate[]; warnings: string[] }> => {
    const response = await fetch('/api/player-analysis/benchmark-candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    if (!response.ok) {
      const data = (await response.json()) as ApiErrorResponse
      throw new Error(data.error ?? 'Failed to fetch benchmark candidates.')
    }
    return (await response.json()) as { candidates: PlayerBenchmarkCandidate[]; warnings: string[] }
  },
}
