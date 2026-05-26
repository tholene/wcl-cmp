import { describe, expect, it } from 'vitest'
import { hasExplicitReportScope, requiresGuildScopedReportDiscovery } from '../player-analysis-scope'

describe('player-analysis scope guards', () => {
  it('treats non-empty reportCodes as explicit scope', () => {
    expect(hasExplicitReportScope({ reportCodes: ['ABC123'] })).toBe(true)
    expect(requiresGuildScopedReportDiscovery({ reportCodes: ['ABC123'] })).toBe(false)
  })

  it('treats fightIdsByReport as explicit scope even without reportCodes', () => {
    const request = {
      fightIdsByReport: {
        ABC123: [7],
      },
    }
    expect(hasExplicitReportScope(request)).toBe(true)
    expect(requiresGuildScopedReportDiscovery(request)).toBe(false)
  })

  it('requires guild discovery when explicit scope is missing or invalid', () => {
    expect(requiresGuildScopedReportDiscovery({ reportCodes: [] })).toBe(true)
    expect(
      requiresGuildScopedReportDiscovery({
        fightIdsByReport: { '': [10], ABC123: [] },
      })
    ).toBe(true)
  })
})
