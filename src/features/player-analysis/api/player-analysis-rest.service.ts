import type { ApiErrorResponse } from '@/features/reports/types/api-error-response'
import type {
  PlayerAnalysisExportJob,
  PlayerAnalysisExportPreview,
  PlayerAnalysisExportRequest,
  PlayerAnalysisExportStartResponse,
  BenchmarkCandidatesRequest,
  BenchmarkCandidatesResponse,
} from '../types/player-analysis.types'

async function safeParseResponse<T>(response: Response): Promise<T> {
  const text = await response.text()
  if (!text.trim()) {
    const hint =
      response.status === 502 || response.status === 503
        ? 'The API server may not be running.'
        : 'Check the backend terminal for errors.'
    throw new Error(`Server returned ${response.status} with no body. ${hint}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    if (!response.ok) throw new Error(`Server error ${response.status}: ${text.slice(0, 300)}`)
    throw new Error('Server returned non-JSON response. Check the backend terminal.')
  }
  if (!response.ok) {
    const err = parsed as ApiErrorResponse
    throw new Error(err.error ?? `Request failed with status ${response.status}.`)
  }
  return parsed as T
}

export const PlayerAnalysisRestService = {
  getExportPreview: async (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportPreview> => {
    const response = await fetch('/api/player-analysis/export-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return safeParseResponse<PlayerAnalysisExportPreview>(response)
  },

  startExport: async (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportStartResponse> => {
    const response = await fetch('/api/player-analysis/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return safeParseResponse<PlayerAnalysisExportStartResponse>(response)
  },

  getExportStatus: async (exportId: string): Promise<PlayerAnalysisExportJob> => {
    const response = await fetch(`/api/player-analysis/exports/${exportId}/status`)
    return safeParseResponse<PlayerAnalysisExportJob>(response)
  },

  getBenchmarkCandidates: async (request: BenchmarkCandidatesRequest): Promise<BenchmarkCandidatesResponse> => {
    const response = await fetch('/api/player-analysis/benchmark-candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return safeParseResponse<BenchmarkCandidatesResponse>(response)
  },
}
