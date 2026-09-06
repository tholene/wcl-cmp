import { describe, expect, it } from 'vitest'
import { buildPlayerEvidence, median, type RosterReportContext } from '../roster-review-evidence'
import type { RosterRankingRow } from '../roster-review-rankings'

const row = (name: string, fightId: number, overrides: Partial<RosterRankingRow> = {}): RosterRankingRow => ({
  fightId,
  name,
  normalizedName: name.toLowerCase(),
  characterId: null,
  className: 'Mage',
  specName: 'Fire',
  roleBucket: 'dps',
  overallPercentile: 70,
  overallSource: 'rankPercent',
  bracketPercentile: 65,
  itemLevel: 620,
  amount: 1000,
  timeframe: 'historical',
  ...overrides,
})

const makeReport = (overrides: Partial<RosterReportContext> = {}): RosterReportContext => ({
  code: 'R1',
  title: 'Raid 1',
  url: 'https://www.warcraftlogs.com/reports/R1',
  startTime: 1_000_000,
  actors: [
    { id: 1, name: 'Bagge', className: 'Mage' },
    { id: 2, name: 'Kormath', className: 'Warrior' },
  ],
  fights: [
    { id: 10, encounterId: 3001, encounterName: 'Boss A', difficulty: 4, kill: true, startTime: 0, endTime: 300_000, friendlyPlayers: [1, 2] },
    { id: 11, encounterId: 3002, encounterName: 'Boss B', difficulty: 4, kill: true, startTime: 400_000, endTime: 640_000, friendlyPlayers: [1] },
    { id: 12, encounterId: 3003, encounterName: 'Boss C', difficulty: 4, kill: false, startTime: 700_000, endTime: 800_000, friendlyPlayers: [1, 2] },
  ],
  rankingRowsByFight: new Map([
    [10, [row('Bagge', 10, { overallPercentile: 90, bracketPercentile: 80, amount: 1500 }), row('Kormath', 10, { overallPercentile: 40, className: 'Warrior', specName: 'Fury', itemLevel: 610 })]],
    [11, [row('Bagge', 11, { overallPercentile: 60, bracketPercentile: 70, itemLevel: 622, amount: 1300 })]],
  ]),
  deathsByFight: new Map([
    [10, [{ targetId: 1, timestamp: 150_000 }, { targetId: 2, timestamp: 20_000 }]],
    [11, []],
  ]),
  ...overrides,
})

describe('median', () => {
  it('handles empty, odd and even inputs', () => {
    expect(median([])).toBeNull()
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })
})

describe('buildPlayerEvidence', () => {
  it('aggregates performance, presence, deaths and signals for a logged player', () => {
    const evidence = buildPlayerEvidence('bagge', [makeReport()])

    expect(evidence.status).toBe('ok')
    expect(evidence.resolvedName).toBe('Bagge')
    expect(evidence.className).toBe('Mage')
    expect(evidence.primarySpecName).toBe('Fire')
    expect(evidence.wclRole).toBe('dps')
    expect(evidence.logPresence).toEqual({ reportsPresent: 1, reportsTotal: 1, presentReportCodes: ['R1'], absentReportCodes: [] })
    expect(evidence.fightPresence).toEqual({ fightsPresent: 3, fightsTotal: 3, fightsUnknown: 0, satOutKillFights: 0 })

    expect(evidence.performance.sampleSize).toBe(2)
    // fights are ordered newest first, so latest = fight 11
    expect(evidence.performance.overall).toEqual({ latest: 60, median: 75, mean: 75, best: 90, worst: 60 })
    expect(evidence.performance.bracket?.median).toBe(75)
    expect(evidence.performance.itemLevel).toEqual({ latest: 622, min: 620, max: 622 })
    expect(evidence.performance.output).toEqual({ latestAmount: 1300, meanAmount: 1400, metric: 'dps' })
    expect(evidence.consistency.spread).toBe(30)
    expect(evidence.consistency.bestMinusMedian).toBe(15)

    expect(evidence.execution).toEqual({
      killFightsChecked: 2,
      killFightsDeathUnknown: 0,
      deaths: 1,
      fightsWithDeath: 1,
      earliestDeathPercentOfFight: 50,
    })
    const codes = evidence.signals.map((signal) => signal.code)
    expect(codes).toContain('limitedSample')
    expect(codes).not.toContain('bestOutlier') // requires sample >= 3
    expect(codes).not.toContain('missingFromLogs')
  })

  it('marks sat-out kill fights and absent reports without calling them absences', () => {
    const second = makeReport({
      code: 'R2',
      title: 'Raid 2',
      startTime: 2_000_000,
      actors: [{ id: 5, name: 'Bagge', className: 'Mage' }],
      rankingRowsByFight: new Map(),
      deathsByFight: new Map(),
    })
    const evidence = buildPlayerEvidence('Kormath', [makeReport(), second])

    expect(evidence.logPresence.reportsPresent).toBe(1)
    expect(evidence.logPresence.absentReportCodes).toEqual(['R2'])
    expect(evidence.fightPresence.satOutKillFights).toBe(1) // fight 11 in R1
    const missing = evidence.signals.find((signal) => signal.code === 'missingFromLogs')
    expect(missing?.detail).toContain('not proof of an unexcused absence')
    expect(evidence.signals.some((signal) => signal.code === 'satOutFights')).toBe(true)
    expect(evidence.performance.overall?.latest).toBe(40)
  })

  it('returns a notFound evidence shape with unknowns for a player missing from all logs', () => {
    const evidence = buildPlayerEvidence('Ghost', [makeReport()])
    expect(evidence.status).toBe('notFound')
    expect(evidence.performance.sampleSize).toBe(0)
    expect(evidence.performance.overall).toBeNull()
    expect(evidence.performance.itemLevel).toBeNull()
    expect(evidence.execution.deaths).toBe(0)
    expect(evidence.signals.map((signal) => signal.code)).toEqual(['notFoundInLogs'])
    expect(evidence.fights.every((fight) => fight.present === false && fight.ranking === null)).toBe(true)
  })

  it('keeps presence unknown when WCL omits fight participants and rankings are missing', () => {
    const report = makeReport({
      fights: [{ id: 10, encounterId: 3001, encounterName: 'Boss A', difficulty: 4, kill: true, startTime: 0, endTime: 300_000, friendlyPlayers: null }],
      rankingRowsByFight: new Map(),
      deathsByFight: new Map(),
    })
    const evidence = buildPlayerEvidence('Kormath', [report])
    expect(evidence.fights[0].present).toBeNull()
    expect(evidence.fights[0].presenceSource).toBe('unknown')
    expect(evidence.fightPresence.fightsUnknown).toBe(1)
    expect(evidence.status).toBe('partial')
    expect(evidence.warnings.some((warning) => warning.includes('presence unknown'))).toBe(true)
  })

  it('marks death data unknown when a fight has no death payload', () => {
    const report = makeReport({ deathsByFight: new Map([[10, null]]) })
    const evidence = buildPlayerEvidence('Bagge', [report])
    expect(evidence.execution.killFightsDeathUnknown).toBe(2)
    expect(evidence.execution.killFightsChecked).toBe(0)
    expect(evidence.status).toBe('partial')
  })

  it('flags best-driven-by-outlier and multiple specs with enough samples', () => {
    const report = makeReport({
      fights: [1, 2, 3, 4].map((n) => ({ id: n, encounterId: 3000 + n, encounterName: `Boss ${n}`, difficulty: 5, kill: true, startTime: n * 1000, endTime: n * 1000 + 100_000, friendlyPlayers: [1] })),
      rankingRowsByFight: new Map([
        [1, [row('Bagge', 1, { overallPercentile: 50 })]],
        [2, [row('Bagge', 2, { overallPercentile: 55 })]],
        [3, [row('Bagge', 3, { overallPercentile: 52, specName: 'Frost' })]],
        [4, [row('Bagge', 4, { overallPercentile: 95 })]],
      ]),
      deathsByFight: new Map([[1, []], [2, []], [3, []], [4, []]]),
    })
    const evidence = buildPlayerEvidence('Bagge', [report])
    const codes = evidence.signals.map((signal) => signal.code)
    expect(codes).toContain('bestOutlier')
    expect(codes).toContain('highSpread')
    expect(codes).toContain('multipleSpecs')
    expect(evidence.specsSeen.sort()).toEqual(['Fire', 'Frost'])
    expect(evidence.primarySpecName).toBe('Fire')
  })
})
