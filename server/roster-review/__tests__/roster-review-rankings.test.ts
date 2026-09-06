import { describe, expect, it } from 'vitest'
import { parseRosterRankingsPayload } from '../roster-review-rankings'

const payload = {
  data: [
    {
      fightID: 12,
      roles: {
        tanks: { characters: [{ name: 'Tanky', id: 1, class: 'Warrior', spec: 'Protection', amount: 900.4, bracketData: 620, rankPercent: 55, bracketPercent: 60 }] },
        healers: { characters: [{ name: 'Healy', class: 'Priest', spec: 'Holy', amount: 1200, bracketData: 618.6, rankPercent: 80.4, bracketPercent: 71 }] },
        dps: {
          characters: [
            { name: 'Bagge', id: 3, class: 'Mage', spec: 'Fire', amount: 1500, bracketData: 622, rankPercent: 91, bracketPercent: 85 },
            { name: 'Ranked', class: 'Rogue', spec: 'Outlaw', amount: 1400, bracketData: 615, rank: '~250', totalParses: 1000, bracketPercent: 40 },
            { name: '', class: 'Hunter' },
          ],
        },
      },
    },
    { fightID: 13, roles: { dps: { characters: [{ name: 'Bagge', class: 'Mage', spec: 'Frost', amount: 1300 }] } } },
  ],
}

describe('parseRosterRankingsPayload', () => {
  it('parses object payloads into rows with fight ids and role buckets', () => {
    const parsed = parseRosterRankingsPayload(payload, 'historical')
    expect(parsed).not.toBeNull()
    expect(parsed!.fightIds).toEqual([12, 13])
    expect(parsed!.rows).toHaveLength(5)

    const bagge = parsed!.rows.find((row) => row.name === 'Bagge' && row.fightId === 12)!
    expect(bagge).toMatchObject({
      normalizedName: 'bagge',
      characterId: 3,
      className: 'Mage',
      specName: 'Fire',
      roleBucket: 'dps',
      overallPercentile: 91,
      overallSource: 'rankPercent',
      bracketPercentile: 85,
      itemLevel: 622,
      amount: 1500,
      timeframe: 'historical',
    })
    expect(parsed!.rows.find((row) => row.name === 'Tanky')!.roleBucket).toBe('tanks')
    expect(parsed!.rows.find((row) => row.name === 'Healy')!.itemLevel).toBe(619)
  })

  it('parses string payloads', () => {
    const parsed = parseRosterRankingsPayload(JSON.stringify(payload), 'current')
    expect(parsed!.rows[0].timeframe).toBe('current')
  })

  it('derives an overall percentile from rank/totalParses only when rankPercent is missing and labels it', () => {
    const parsed = parseRosterRankingsPayload(payload, 'historical')
    const ranked = parsed!.rows.find((row) => row.name === 'Ranked')!
    expect(ranked.overallSource).toBe('derivedFromRank')
    expect(ranked.overallPercentile).toBe(75)
  })

  it('keeps missing values unknown', () => {
    const parsed = parseRosterRankingsPayload(payload, 'historical')
    const frost = parsed!.rows.find((row) => row.name === 'Bagge' && row.fightId === 13)!
    expect(frost.overallPercentile).toBeNull()
    expect(frost.overallSource).toBeNull()
    expect(frost.bracketPercentile).toBeNull()
    expect(frost.itemLevel).toBeNull()
  })

  it('returns null for unparsable or shapeless payloads', () => {
    expect(parseRosterRankingsPayload('not json', 'historical')).toBeNull()
    expect(parseRosterRankingsPayload(null, 'historical')).toBeNull()
    expect(parseRosterRankingsPayload({ nope: true }, 'historical')).toBeNull()
  })

  it('records null fight ids when WCL omits them', () => {
    const parsed = parseRosterRankingsPayload({ data: [{ roles: { dps: { characters: [{ name: 'X' }] } } }] }, 'historical')
    expect(parsed!.fightIds).toEqual([null])
    expect(parsed!.rows[0].fightId).toBeNull()
  })
})
