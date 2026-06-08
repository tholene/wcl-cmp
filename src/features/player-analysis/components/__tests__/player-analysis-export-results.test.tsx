import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PlayerAnalysisExportJob } from '../../types/player-analysis.types'

vi.mock('@/lib/api-base-url', () => ({
  apiUrl: (path: string) => `https://api.example.com${path}`,
}))

import { PlayerAnalysisExportResults } from '../player-analysis-export-results'

describe('PlayerAnalysisExportResults', () => {
  it('uses the API URL builder for ZIP and individual file downloads', () => {
    const job = {
      status: 'complete',
      warnings: [],
      files: [
        {
          filename: 'bundle.zip',
          kind: 'zip',
          sizeBytes: 100,
          downloadUrl: '/api/player-analysis/exports/export-id/bundle.zip',
        },
        {
          filename: 'README.md',
          kind: 'readme',
          sizeBytes: 20,
          downloadUrl: '/api/player-analysis/exports/export-id/README.md',
        },
      ],
    } as unknown as PlayerAnalysisExportJob

    const { container } = render(
      <PlayerAnalysisExportResults job={job} exportId="export-id" onReset={vi.fn()} />
    )

    const downloadLinks = Array.from(container.querySelectorAll('a')).map((link) =>
      link.getAttribute('href')
    )

    expect(downloadLinks).toEqual([
      'https://api.example.com/api/player-analysis/exports/export-id/bundle.zip',
      'https://api.example.com/api/player-analysis/exports/export-id/README.md',
    ])
  })
})
