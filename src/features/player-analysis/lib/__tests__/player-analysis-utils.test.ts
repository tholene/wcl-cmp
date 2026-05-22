import { describe, it, expect } from 'vitest'
import { flattenAndDeduplicateBossKills } from '../player-analysis-utils'

const BASE_TIME = 1_700_000_000_000

const makeGroup = (
  encounterId: number,
  difficulty: number,
  fights: Array<{ startTime?: number; durationMs?: number; reportCode?: string; fightId?: number }>
) => ({
  encounterId,
  encounterName: `Boss ${encounterId}`,
  difficulty,
  fights: fights.map((f, i) => ({
    reportCode: f.reportCode ?? `R${i}`,
    reportTitle: `Report ${i}`,
    fightId: f.fightId ?? i + 1,
    startTime: f.startTime ?? BASE_TIME,
    durationMs: f.durationMs ?? 120_000,
  })),
})

describe('flattenAndDeduplicateBossKills', () => {
  it('collapses two fights with same encounter, difficulty, date, and duration', () => {
    const groups = [
      makeGroup(1, 16, [{ reportCode: 'A' }, { reportCode: 'B' }]),
    ]
    const result = flattenAndDeduplicateBossKills(groups)
    expect(result).toHaveLength(1)
    expect(result[0].duplicateReportCount).toBe(1)
  })

  it('does not merge fights with different difficulties', () => {
    const groups = [
      makeGroup(1, 14, [{ reportCode: 'A' }]),
      makeGroup(1, 16, [{ reportCode: 'B' }]),
    ]
    const result = flattenAndDeduplicateBossKills(groups)
    expect(result).toHaveLength(2)
  })

  it('does not merge fights with different dates', () => {
    const DAY = 24 * 60 * 60 * 1000
    const groups = [
      makeGroup(1, 16, [{ reportCode: 'A', startTime: BASE_TIME }]),
      makeGroup(1, 16, [{ reportCode: 'B', startTime: BASE_TIME + DAY }]),
    ]
    const result = flattenAndDeduplicateBossKills(groups)
    expect(result).toHaveLength(2)
  })

  it('does not merge fights with durations outside the 5s bucket', () => {
    const groups = [
      makeGroup(1, 16, [{ reportCode: 'A', durationMs: 120_000 }]),
      makeGroup(1, 16, [{ reportCode: 'B', durationMs: 130_000 }]),
    ]
    const result = flattenAndDeduplicateBossKills(groups)
    expect(result).toHaveLength(2)
  })

  it('returns an empty array for empty input', () => {
    expect(flattenAndDeduplicateBossKills([])).toEqual([])
  })
})
