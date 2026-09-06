import { describe, expect, it } from 'vitest'
import { makeAvailabilityEntry, makePlayerEvidence } from '@/test/factories/roster-review.factory'
import { buildRosterReviewRows, sortRosterRows } from '../evidence-grouping'

const targets = { total: 20, tanks: 2, healers: 4, dps: 14 }

describe('buildRosterReviewRows', () => {
  it('tags strong evidence, limited evidence, reliability and availability notes', () => {
    const availability = [
      makeAvailabilityEntry({ playerName: 'Strong', role: 'ranged' }),
      makeAvailabilityEntry({ playerName: 'Thin', role: 'ranged', availability: 'late' }),
      makeAvailabilityEntry({ playerName: 'NoData', role: 'melee' }),
    ]
    const evidence = new Map([
      ['strong', makePlayerEvidence({ playerName: 'Strong' })],
      ['thin', makePlayerEvidence({
        playerName: 'Thin',
        performance: { ...makePlayerEvidence().performance, sampleSize: 1, overall: { latest: 50, median: 50, mean: 50, best: 50, worst: 50 } },
        logPresence: { reportsPresent: 1, reportsTotal: 2, presentReportCodes: ['R1'], absentReportCodes: ['R2'] },
      })],
    ])
    const rows = buildRosterReviewRows(availability, evidence, {}, targets)
    const byName = Object.fromEntries(rows.map((row) => [row.entry.playerName, row]))
    expect(byName.Strong.tags).toContain('strongEvidence')
    expect(byName.Strong.roleRank).toBe(1)
    expect(byName.Thin.tags).toEqual(expect.arrayContaining(['limitedEvidence', 'reliabilityNote', 'availabilityNote']))
    expect(byName.NoData.tags).toEqual(['limitedEvidence'])
    expect(byName.NoData.evidence).toBeNull()
  })

  it('marks boundary rows around the role target and flags gear gaps', () => {
    const availability = Array.from({ length: 6 }, (_, i) => makeAvailabilityEntry({ playerName: `H${i}`, role: 'healer' }))
    const evidence = new Map(
      availability.map((entry, i) => [
        entry.playerName.toLowerCase(),
        makePlayerEvidence({
          playerName: entry.playerName,
          performance: {
            ...makePlayerEvidence().performance,
            overall: { latest: 90 - i * 10, median: 90 - i * 10, mean: 90 - i * 10, best: 95, worst: 50 },
            itemLevel: { latest: i === 5 ? 600 : 620, min: 600, max: 620 },
          },
        }),
      ])
    )
    const rows = buildRosterReviewRows(availability, evidence, {}, targets)
    const boundary = rows.filter((row) => row.tags.includes('boundary')).map((row) => row.entry.playerName)
    // healer target 4 → ranks 2..6 are within two places
    expect(boundary).toEqual(['H1', 'H2', 'H3', 'H4', 'H5'])
    expect(rows.find((row) => row.entry.playerName === 'H5')!.tags).toContain('gearNote')
  })
})

describe('sortRosterRows', () => {
  it('sorts numerically and sinks unknown values regardless of direction', () => {
    const availability = [
      makeAvailabilityEntry({ playerName: 'A' }),
      makeAvailabilityEntry({ playerName: 'B' }),
      makeAvailabilityEntry({ playerName: 'C' }),
    ]
    const evidence = new Map([
      ['a', makePlayerEvidence({ playerName: 'A', performance: { ...makePlayerEvidence().performance, overall: { latest: 40, median: 40, mean: 40, best: 40, worst: 40 } } })],
      ['b', makePlayerEvidence({ playerName: 'B' })],
    ])
    const rows = buildRosterReviewRows(availability, evidence, {}, targets)
    expect(sortRosterRows(rows, 'overallMedian', 'desc').map((r) => r.entry.playerName)).toEqual(['B', 'A', 'C'])
    expect(sortRosterRows(rows, 'overallMedian', 'asc').map((r) => r.entry.playerName)).toEqual(['A', 'B', 'C'])
    expect(sortRosterRows(rows, 'name', 'desc').map((r) => r.entry.playerName)).toEqual(['C', 'B', 'A'])
  })
})
