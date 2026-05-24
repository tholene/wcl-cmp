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
  const context = { wclSite: 'classic' as const, guildId: '61324', region: 'EU' }

  it('getExportPreview posts to /api/player-analysis/export-preview', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ requestedPlayerName: 'Foo', warnings: [] }))
    await PlayerAnalysisRestService.getExportPreview({ playerName: 'Foo' } as never, context)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/player-analysis/export-preview',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ playerName: 'Foo', wclContext: context }),
      })
    )
  })

  it('startExport posts to /api/player-analysis/export', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ exportId: 'e1', status: 'queued', statusUrl: '/s' }))
    await PlayerAnalysisRestService.startExport({ playerName: 'Foo' } as never, context)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/player-analysis/export',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ playerName: 'Foo', wclContext: context }),
      })
    )
  })

  it('getExportStatus gets /api/player-analysis/exports/:id/status', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ exportId: 'abc', status: 'complete' }))
    await PlayerAnalysisRestService.getExportStatus('abc')
    expect(mockFetch).toHaveBeenCalledWith('/api/player-analysis/exports/abc/status', undefined)
  })

  it('getBenchmarkCandidates posts to /api/player-analysis/benchmark-candidates', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ groups: [], warnings: [] }))
    await PlayerAnalysisRestService.getBenchmarkCandidates(
      { baselines: [], targetPercentile: 75, metric: 'dps' },
      context
    )
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/player-analysis/benchmark-candidates',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          baselines: [],
          targetPercentile: 75,
          metric: 'dps',
          wclContext: context,
        }),
      })
    )
  })

  it('getRecentPlayers gets /api/players/recent', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ players: [], generatedAt: 0 }))
    await PlayerAnalysisRestService.getRecentPlayers(context)
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/players/recent?wclSite=classic&guildId=61324&region=EU',
      undefined
    )
  })
})
