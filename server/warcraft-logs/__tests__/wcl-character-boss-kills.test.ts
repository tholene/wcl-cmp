import { describe, expect, it, vi } from 'vitest'
import {
  dedupeBossKills,
  discoverWclCharacterBossKills,
} from '../wcl-character-boss-kills'
import type { WclConfig } from '../wcl-config'
import type { WclCharacterResolveResult } from '../wcl-character-resolver.types'
import type {
  WclCharacterBossKill,
  WclCharacterBossKillsRequest,
} from '../wcl-character-boss-kills.types'

const BASE_CONFIG: WclConfig = {
  WCL_CLIENT_ID: 'client-id',
  WCL_CLIENT_SECRET: 'client-secret',
  WCL_GUILD_ID: undefined,
  WCL_REGION: undefined,
  WCL_REDIRECT_URI: 'http://localhost:5781/auth/callback',
  API_PORT: 5781,
}

const RESOLVED_CHARACTER: WclCharacterResolveResult = {
  status: 'resolved',
  warnings: [],
  character: {
    source: 'exactLookup',
    site: 'retail',
    id: 80203972,
    name: 'Bagge',
    normalizedName: 'bagge',
    region: 'eu',
    realmSlug: 'the-maelstrom',
    realmName: 'The Maelstrom',
    canonicalUrl: 'https://www.warcraftlogs.com/character/eu/the-maelstrom/Bagge',
    className: null,
    specName: null,
    faction: 'Alliance',
    level: 90,
    warnings: [],
  },
}

function makeBaseKill(partial: Partial<WclCharacterBossKill>): WclCharacterBossKill {
  return {
    site: 'retail',
    reportCode: 'A',
    reportTitle: 'Raid',
    fightId: 1,
    encounterId: 3176,
    encounterName: 'Imperator Averzian',
    difficulty: 3,
    kill: true,
    durationMs: 120000,
    startTime: 123,
    playerItemLevel: null,
    className: null,
    specName: null,
    percentile: null,
    metric: null,
    source: 'characterReports',
    warnings: [],
    ...partial,
  }
}

describe('dedupeBossKills', () => {
  it('dedupes by reportCode + fightId while preserving order', () => {
    const input = [
      makeBaseKill({ reportCode: 'A', fightId: 1 }),
      makeBaseKill({ reportCode: 'A', fightId: 1, encounterName: 'Duplicate' }),
      makeBaseKill({ reportCode: 'A', fightId: 2 }),
    ]

    const result = dedupeBossKills(input)

    expect(result).toHaveLength(2)
    expect(result[0].encounterName).toBe('Imperator Averzian')
    expect(result[1].fightId).toBe(2)
  })
})

describe('discoverWclCharacterBossKills', () => {
  it('returns validation error for incomplete identity request', async () => {
    const result = await discoverWclCharacterBossKills(BASE_CONFIG, {
      region: 'eu',
      characterName: 'Bagge',
    })

    expect(result).toEqual({
      status: 'error',
      character: null,
      bossKills: [],
      warnings: [],
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Exact lookup requires region, realmSlug, and characterName together.',
      },
    })
  })

  it('returns validation error when limit is invalid', async () => {
    const resolver = vi.fn(async () => RESOLVED_CHARACTER)

    const result = await discoverWclCharacterBossKills(
      BASE_CONFIG,
      {
        region: 'eu',
        realmSlug: 'the-maelstrom',
        characterName: 'Bagge',
        limit: 0,
      },
      { resolver }
    )

    expect(result).toEqual({
      status: 'error',
      character: null,
      bossKills: [],
      warnings: [],
      error: {
        code: 'VALIDATION_ERROR',
        message: 'limit must be a positive integer when provided.',
      },
    })
    expect(resolver).not.toHaveBeenCalled()
  })

  it('supports characterUrl request path and enriches rankings', async () => {
    const resolver = vi.fn(async () => RESOLVED_CHARACTER)
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        characterData: {
          character: {
            id: 80203972,
            name: 'Bagge',
            recentReports: {
              data: [
                {
                  code: 'a6kLvHB3GnTFt7Zw',
                  title: 'VS / DR / MQD',
                  startTime: 1000,
                  zone: { id: 46, name: 'VS / DR / MQD' },
                  fights: [
                    {
                      id: 5,
                      encounterID: 3176,
                      name: 'Imperator Averzian',
                      kill: true,
                      difficulty: 3,
                      startTime: 200,
                      endTime: 400,
                    },
                  ],
                },
              ],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        reportData: {
          report: {
            rankings: JSON.stringify({
              data: [
                {
                  roles: {
                    dps: {
                      characters: [
                        {
                          id: 80203972,
                          name: 'Bagge',
                          class: 'Warrior',
                          spec: 'Arms',
                          bracketData: 289,
                          rankPercent: 99,
                        },
                      ],
                    },
                  },
                },
              ],
            }),
          },
        },
      })

    const request: WclCharacterBossKillsRequest = {
      characterUrl: 'https://www.warcraftlogs.com/character/eu/the-maelstrom/bagge',
    }

    const result = await discoverWclCharacterBossKills(BASE_CONFIG, request, { resolver, query })

    expect(result.status).toBe('ok')
    expect(result.character?.name).toBe('Bagge')
    expect(result.bossKills).toEqual([
      {
        site: 'retail',
        reportCode: 'a6kLvHB3GnTFt7Zw',
        reportTitle: 'VS / DR / MQD',
        fightId: 5,
        encounterId: 3176,
        encounterName: 'Imperator Averzian',
        difficulty: 3,
        kill: true,
        durationMs: 200,
        startTime: 1200,
        playerItemLevel: 289,
        className: 'Warrior',
        specName: 'Arms',
        percentile: 99,
        metric: null,
        source: 'reportVerification',
        warnings: [],
      },
    ])

    expect(resolver).toHaveBeenCalledWith(BASE_CONFIG, request)
    expect(query).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        site: 'retail',
        variables: {
          name: 'Bagge',
          serverSlug: 'the-maelstrom',
          serverRegion: 'EU',
          limit: 5,
        },
      })
    )
  })

  it('supports exact tuple request path and filters wipes by default', async () => {
    const resolver = vi.fn(async () => RESOLVED_CHARACTER)
    const query = vi.fn().mockResolvedValueOnce({
      characterData: {
        character: {
          recentReports: {
            data: [
              {
                code: 'R1',
                title: 'VS / DR / MQD',
                startTime: 1000,
                zone: { id: 46, name: 'VS / DR / MQD' },
                fights: [
                  {
                    id: 1,
                    encounterID: 3176,
                    name: 'Imperator Averzian',
                    kill: false,
                    difficulty: 3,
                    startTime: 100,
                    endTime: 300,
                  },
                  {
                    id: 2,
                    encounterID: 3177,
                    name: 'Vorasius',
                    kill: true,
                    difficulty: 3,
                    startTime: 400,
                    endTime: 700,
                  },
                ],
              },
            ],
          },
        },
      },
    })

    const result = await discoverWclCharacterBossKills(
      BASE_CONFIG,
      {
        wclSite: 'retail',
        region: 'eu',
        realmSlug: 'the-maelstrom',
        characterName: 'Bagge',
        limit: 10,
      },
      { resolver, query }
    )

    expect(result.status).toBe('ok')
    expect(result.bossKills).toHaveLength(1)
    expect(result.bossKills[0]).toMatchObject({
      reportCode: 'R1',
      fightId: 2,
      kill: true,
      source: 'characterReports',
    })
  })

  it('returns not_found when resolver cannot resolve character', async () => {
    const resolver = vi.fn(async (): Promise<WclCharacterResolveResult> => ({
      status: 'not_found',
      character: null,
      warnings: ['missing'],
    }))

    const result = await discoverWclCharacterBossKills(
      BASE_CONFIG,
      {
        region: 'eu',
        realmSlug: 'the-maelstrom',
        characterName: 'Unknown',
      },
      { resolver }
    )

    expect(result).toEqual({
      status: 'not_found',
      character: null,
      bossKills: [],
      warnings: ['missing'],
    })
  })

  it('maps resolver unsupported status', async () => {
    const resolver = vi.fn(async (): Promise<WclCharacterResolveResult> => ({
      status: 'unsupported',
      character: null,
      warnings: ['schema'],
      error: {
        code: 'UNSUPPORTED_QUERY_SCHEMA',
        message: 'unsupported',
      },
    }))

    const result = await discoverWclCharacterBossKills(
      BASE_CONFIG,
      {
        region: 'eu',
        realmSlug: 'the-maelstrom',
        characterName: 'Bagge',
      },
      { resolver }
    )

    expect(result).toEqual({
      status: 'unsupported',
      character: null,
      bossKills: [],
      warnings: ['schema'],
      error: {
        code: 'UNSUPPORTED_QUERY_SCHEMA',
        message: 'unsupported',
      },
    })
  })

  it('returns unsupported when reports are unavailable', async () => {
    const resolver = vi.fn(async () => RESOLVED_CHARACTER)
    const query = vi.fn().mockResolvedValueOnce({
      characterData: {
        character: {
          recentReports: {
            data: [],
          },
        },
      },
    })

    const result = await discoverWclCharacterBossKills(
      BASE_CONFIG,
      {
        region: 'eu',
        realmSlug: 'the-maelstrom',
        characterName: 'Bagge',
      },
      { resolver, query }
    )

    expect(result.status).toBe('unsupported')
    expect(result.error).toEqual({
      code: 'WCL_CHARACTER_REPORTS_EMPTY',
      message: 'WCL returned no recent reports for the resolved character.',
      hint: 'Try a different character or verify report visibility on the selected WCL site.',
    })
  })
})
