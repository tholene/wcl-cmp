import { describe, expect, it } from 'vitest'
import { makeAvailabilityEntry, makePlayerEvidence } from '@/test/factories/roster-review.factory'
import { buildCandidateComparison } from '../candidate-comparison'

const dim = (result: ReturnType<typeof buildCandidateComparison>, key: string) => result.dimensions.find((d) => d.key === key)!

describe('buildCandidateComparison', () => {
  it('finds a performance advantage and an attendance advantage on the other side', () => {
    const a = makePlayerEvidence({ playerName: 'A', performance: { ...makePlayerEvidence().performance, overall: { latest: 85, median: 85, mean: 85, best: 90, worst: 70 } } })
    const b = makePlayerEvidence({
      playerName: 'B',
      performance: { ...makePlayerEvidence().performance, overall: { latest: 70, median: 70, mean: 70, best: 80, worst: 60 } },
      logPresence: { reportsPresent: 2, reportsTotal: 2, presentReportCodes: ['R1', 'R2'], absentReportCodes: [] },
    })
    a.logPresence = { reportsPresent: 1, reportsTotal: 2, presentReportCodes: ['R1'], absentReportCodes: ['R2'] }
    const result = buildCandidateComparison(
      { name: 'A', entry: makeAvailabilityEntry({ playerName: 'A' }), evidence: a },
      { name: 'B', entry: makeAvailabilityEntry({ playerName: 'B', availability: 'late' }), evidence: b }
    )
    expect(dim(result, 'performance').verdict).toBe('aAdvantage')
    expect(dim(result, 'attendance').verdict).toBe('bAdvantage')
    expect(dim(result, 'availability').verdict).toBe('aAdvantage')
    expect(dim(result, 'consistency').verdict).toBe('roughlyEqual')
    expect(dim(result, 'composition').verdict).toBe('insufficient')
    expect(result.draftExplanation).toContain('Performance: A advantage')
    expect(result.draftExplanation).toContain('Log presence: B advantage')
    expect(result.draftExplanation.endsWith('Conclusion: ')).toBe(true)
  })

  it('reports insufficient evidence when a player has no evidence or a tiny sample', () => {
    const b = makePlayerEvidence({ playerName: 'B', performance: { ...makePlayerEvidence().performance, sampleSize: 1 } })
    const result = buildCandidateComparison(
      { name: 'A', entry: null, evidence: null },
      { name: 'B', entry: makeAvailabilityEntry({ playerName: 'B' }), evidence: b }
    )
    expect(dim(result, 'performance').verdict).toBe('insufficient')
    expect(dim(result, 'consistency').verdict).toBe('insufficient')
    expect(dim(result, 'attendance').verdict).toBe('insufficient')
    expect(dim(result, 'availability').aValue).toBe('not entered')
  })

  it('treats small differences as roughly equal', () => {
    const a = makePlayerEvidence({ playerName: 'A', performance: { ...makePlayerEvidence().performance, overall: { latest: 75, median: 75, mean: 75, best: 90, worst: 60 } } })
    const b = makePlayerEvidence({ playerName: 'B', performance: { ...makePlayerEvidence().performance, overall: { latest: 70, median: 70, mean: 70, best: 90, worst: 60 } } })
    const result = buildCandidateComparison({ name: 'A', entry: null, evidence: a }, { name: 'B', entry: null, evidence: b })
    expect(dim(result, 'performance').verdict).toBe('roughlyEqual')
    expect(dim(result, 'gear').verdict).toBe('roughlyEqual')
  })
})
