import { apiUrl } from '@/lib/api-base-url'
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
  const trimmed = text.trim()
  if (!trimmed) {
    const hint =
      response.status === 502 || response.status === 503
        ? 'The API server may not be running.'
        : 'Check the backend terminal for errors.'
    throw new Error(`Server returned ${response.status} with no body. ${hint}`)
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
  const looksLikeHtml = trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html')

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    if (looksLikeHtml || contentType.includes('text/html')) {
      throw new Error(
        `Server returned HTML instead of JSON (status ${response.status}). The backend route may be down or misrouted.`
      )
    }
    if (!response.ok) {
      throw new Error(`Server returned non-JSON error (status ${response.status}). Check backend logs.`)
    }
    throw new Error(`Server returned invalid JSON (status ${response.status}). Check backend logs.`)
  }

  if (!response.ok) {
    const err = parsed as ApiErrorResponse
    const baseMessage = err.error ?? `Request failed with status ${response.status}.`
    const withCode = err.code ? `[${err.code}] ${baseMessage}` : baseMessage
    throw new Error(err.hint ? `${withCode} ${err.hint}` : withCode)
  }
  return parsed as T
}

export const PlayerAnalysisRestService = {
  getExportPreview: async (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportPreview> => {
    const response = await fetch(apiUrl('/api/player-analysis/export-preview'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return safeParseResponse<PlayerAnalysisExportPreview>(response)
  },

  startExport: async (request: PlayerAnalysisExportRequest): Promise<PlayerAnalysisExportStartResponse> => {
    const response = await fetch(apiUrl('/api/player-analysis/export'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return safeParseResponse<PlayerAnalysisExportStartResponse>(response)
  },

  getExportStatus: async (exportId: string): Promise<PlayerAnalysisExportJob> => {
    const response = await fetch(apiUrl(`/api/player-analysis/exports/${exportId}/status`))
    return safeParseResponse<PlayerAnalysisExportJob>(response)
  },

  getBenchmarkCandidates: async (request: BenchmarkCandidatesRequest): Promise<BenchmarkCandidatesResponse> => {
    const response = await fetch(apiUrl('/api/player-analysis/benchmark-candidates'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return safeParseResponse<BenchmarkCandidatesResponse>(response)
  },
}
