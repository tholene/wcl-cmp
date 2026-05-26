import { describe, it, expect } from 'vitest'
import { flattenAndDeduplicateBossKills, mapGlobalBossKillsToBossGroups } from '../player-analysis-utils'

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
    kill: true,
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

describe('mapGlobalBossKillsToBossGroups', () => {
  it('groups by encounter+difficulty and preserves enrichment + explicit scope fields', () => {
    const groups = mapGlobalBossKillsToBossGroups([
      {
        site: 'retail',
        reportCode: 'ABC123',
        reportTitle: 'Raid night',
        fightId: 5,
        encounterId: 1001,
        encounterName: 'Boss Alpha',
        difficulty: 4,
        kill: true,
        durationMs: 180000,
        startTime: BASE_TIME + 1000,
        playerItemLevel: 700,
        className: 'Warrior',
        specName: 'Fury',
        percentile: 92,
        metric: 'dps',
        source: 'reportVerification',
        warnings: ['Ranking entry missing totalParses'],
      },
      {
        site: 'retail',
        reportCode: 'DEF456',
        reportTitle: 'Raid night alt upload',
        fightId: 6,
        encounterId: 1001,
        encounterName: 'Boss Alpha',
        difficulty: 4,
        kill: true,
        durationMs: 181000,
        startTime: BASE_TIME + 2000,
        playerItemLevel: 701,
        className: 'Warrior',
        specName: 'Fury',
        percentile: 93,
        metric: 'dps',
        source: 'reportVerification',
        warnings: [],
      },
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].encounterId).toBe(1001)
    expect(groups[0].difficulty).toBe(4)
    expect(groups[0].fights).toHaveLength(2)
    expect(groups[0].fights[0]).toMatchObject({
      kill: true,
      reportCode: 'DEF456',
      fightId: 6,
      playerClassName: 'Warrior',
      playerSpecName: 'Fury',
      playerParse: 93,
      playerMetric: 'dps',
    })
    expect(groups[0].fights[1]).toMatchObject({
      reportCode: 'ABC123',
      fightId: 5,
      warnings: ['Ranking entry missing totalParses'],
    })
  })
})
