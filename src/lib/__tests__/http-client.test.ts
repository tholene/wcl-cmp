import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiFetch } from '../http-client'

const mockFetch = vi.fn<typeof fetch>()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

const makeResponse = (
  body: string,
  status = 200,
  headers: Record<string, string> = { 'content-type': 'application/json' }
): Response =>
  ({
    status,
    ok: status >= 200 && status < 300,
    text: () => Promise.resolve(body),
    headers: { get: (key: string) => headers[key] ?? null },
  }) as unknown as Response

describe('apiFetch', () => {
  it('returns parsed JSON on a 200 response', async () => {
    mockFetch.mockResolvedValue(makeResponse(JSON.stringify({ foo: 'bar' })))
    const result = await apiFetch<{ foo: string }>('/api/test')
    expect(result).toEqual({ foo: 'bar' })
  })

  it('throws with API server hint on 502 with empty body', async () => {
    mockFetch.mockResolvedValue(makeResponse('', 502))
    await expect(apiFetch('/api/test')).rejects.toThrow('The API server may not be running.')
  })

  it('throws with backend hint on 500 with empty body', async () => {
    mockFetch.mockResolvedValue(makeResponse('', 500))
    await expect(apiFetch('/api/test')).rejects.toThrow('Check the backend terminal for errors.')
  })

  it('throws when the server returns HTML instead of JSON', async () => {
    mockFetch.mockResolvedValue(
      makeResponse('<!doctype html><html><body>Not found</body></html>', 404, {
        'content-type': 'text/html',
      })
    )
    await expect(apiFetch('/api/test')).rejects.toThrow('Server returned HTML instead of JSON')
  })

  it('throws when response body is not valid JSON', async () => {
    mockFetch.mockResolvedValue(makeResponse('not json', 500))
    await expect(apiFetch('/api/test')).rejects.toThrow('non-JSON error')
  })

  it('uses error field from ApiErrorResponse on non-ok responses', async () => {
    mockFetch.mockResolvedValue(
      makeResponse(JSON.stringify({ error: 'Guild not found' }), 404)
    )
    await expect(apiFetch('/api/test')).rejects.toThrow('Guild not found')
  })

  it('includes error code prefix when ApiErrorResponse has a code', async () => {
    mockFetch.mockResolvedValue(
      makeResponse(JSON.stringify({ error: 'Missing token', code: 'AUTH_001' }), 401)
    )
    await expect(apiFetch('/api/test')).rejects.toThrow('[AUTH_001] Missing token')
  })

  it('appends hint when ApiErrorResponse has a hint', async () => {
    mockFetch.mockResolvedValue(
      makeResponse(
        JSON.stringify({ error: 'Rate limited', hint: 'Try again in 60s.' }),
        429
      )
    )
    await expect(apiFetch('/api/test')).rejects.toThrow('Rate limited Try again in 60s.')
  })

  it('passes RequestInit to fetch', async () => {
    mockFetch.mockResolvedValue(makeResponse(JSON.stringify({})))
    await apiFetch('/api/test', { method: 'POST', body: '{}' })
    expect(mockFetch).toHaveBeenCalledWith('/api/test', { method: 'POST', body: '{}' })
  })
})
