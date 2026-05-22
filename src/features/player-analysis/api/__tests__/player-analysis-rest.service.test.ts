import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlayerAnalysisRestService } from '../player-analysis-rest.service'

const mockFetch = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  vi.stubEnv('VITE_API_BASE_URL', '')
})

const jsonResponse = (body: unknown, status = 200) =>
  ({
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { get: () => 'application/json' },
  }) as unknown as Response

describe('PlayerAnalysisRestService endpoints', () => {
  it('getExportPreview posts to /api/player-analysis/export-preview', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ requestedPlayerName: 'Foo', warnings: [] }))
    await PlayerAnalysisRestService.getExportPreview({ playerName: 'Foo' } as never)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/player-analysis/export-preview',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('startExport posts to /api/player-analysis/export', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ exportId: 'e1', status: 'queued', statusUrl: '/s' }))
    await PlayerAnalysisRestService.startExport({ playerName: 'Foo' } as never)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/player-analysis/export',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('getExportStatus gets /api/player-analysis/exports/:id/status', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ exportId: 'abc', status: 'complete' }))
    await PlayerAnalysisRestService.getExportStatus('abc')
    expect(mockFetch).toHaveBeenCalledWith('/api/player-analysis/exports/abc/status', undefined)
  })

  it('getBenchmarkCandidates posts to /api/player-analysis/benchmark-candidates', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ groups: [], warnings: [] }))
    await PlayerAnalysisRestService.getBenchmarkCandidates({ baselines: [], targetPercentile: 75, metric: 'dps' })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/player-analysis/benchmark-candidates',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('getRecentPlayers gets /api/players/recent', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ players: [], generatedAt: 0 }))
    await PlayerAnalysisRestService.getRecentPlayers()
    expect(mockFetch).toHaveBeenCalledWith('/api/players/recent', undefined)
  })
})
