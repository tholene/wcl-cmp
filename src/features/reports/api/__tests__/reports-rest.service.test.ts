import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReportsRestService } from '../reports-rest.service'
import { createMockRecentReportsResponse } from '@/test/factories/reports.factory'

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

describe('ReportsRestService.listRecentReports', () => {
  it('returns the parsed response on success', async () => {
    const payload = createMockRecentReportsResponse()
    mockFetch.mockResolvedValue(jsonResponse(payload))

    const result = await ReportsRestService.listRecentReports({ wclSite: 'retail' })
    expect(result).toEqual(payload)
  })

  it('calls the correct endpoint with required query params', async () => {
    mockFetch.mockResolvedValue(jsonResponse(createMockRecentReportsResponse()))
    await ReportsRestService.listRecentReports({ wclSite: 'retail' })
    expect(mockFetch).toHaveBeenCalledWith('/api/reports/recent?wclSite=retail', undefined)
  })

  it('includes optional guildId and region query params', async () => {
    mockFetch.mockResolvedValue(jsonResponse(createMockRecentReportsResponse()))
    await ReportsRestService.listRecentReports({ wclSite: 'classic', guildId: '61324', region: 'EU' })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/reports/recent?wclSite=classic&guildId=61324&region=EU',
      undefined
    )
  })

  it('throws when the server returns a 404 with an error message', async () => {
    mockFetch.mockResolvedValue(jsonResponse({ error: 'Guild not configured' }, 404))
    await expect(ReportsRestService.listRecentReports({ wclSite: 'retail' })).rejects.toThrow('Guild not configured')
  })

  it('throws when the server returns an empty body', async () => {
    mockFetch.mockResolvedValue({
      status: 502,
      ok: false,
      text: () => Promise.resolve(''),
      headers: { get: () => null },
    } as unknown as Response)
    await expect(ReportsRestService.listRecentReports({ wclSite: 'retail' })).rejects.toThrow(
      'The API server may not be running.'
    )
  })
})
