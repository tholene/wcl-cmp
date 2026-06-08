import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('buildExportDownloadUrl', () => {
  it('uses the configured API base URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/')

    const { buildExportDownloadUrl } = await import('../player-analysis-export-download-url')

    expect(buildExportDownloadUrl('export-id', 'bundle.zip')).toBe(
      'https://api.example.com/api/player-analysis/exports/export-id/bundle.zip'
    )
  })

  it('uses a local relative URL without an API base URL', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')

    const { buildExportDownloadUrl } = await import('../player-analysis-export-download-url')

    expect(buildExportDownloadUrl('export-id', 'bundle.zip')).toBe(
      '/api/player-analysis/exports/export-id/bundle.zip'
    )
  })

  it('encodes the filename as one route segment', async () => {
    vi.stubEnv('VITE_API_BASE_URL', '')

    const { buildExportDownloadUrl } = await import('../player-analysis-export-download-url')

    expect(buildExportDownloadUrl('export-id', 'player data #1.csv')).toBe(
      '/api/player-analysis/exports/export-id/player%20data%20%231.csv'
    )
  })
})
