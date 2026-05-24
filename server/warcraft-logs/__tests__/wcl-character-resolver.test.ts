import { beforeEach, describe, expect, it, vi } from 'vitest'
import { queryWclGraphQl } from '../wcl-client'
import {
  resolveWclCharacter,
  validateWclCharacterResolveRequest,
} from '../wcl-character-resolver'
import type { WclConfig } from '../wcl-config'

vi.mock('../wcl-client', () => ({
  queryWclGraphQl: vi.fn(),
}))

const mockedQueryWclGraphQl = vi.mocked(queryWclGraphQl)

const BASE_CONFIG: WclConfig = {
  WCL_CLIENT_ID: 'client-id',
  WCL_CLIENT_SECRET: 'client-secret',
  WCL_GUILD_ID: undefined,
  WCL_REGION: undefined,
  WCL_REDIRECT_URI: 'http://localhost:5781/auth/callback',
  API_PORT: 5781,
}

describe('validateWclCharacterResolveRequest', () => {
  it('rejects empty payload', () => {
    const result = validateWclCharacterResolveRequest({})

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Provide either characterUrl or the exact tuple: region, realmSlug, and characterName.',
      },
    })
  })

  it('rejects incomplete exact tuple payload', () => {
    const result = validateWclCharacterResolveRequest({
      region: 'eu',
      realmSlug: 'the-maelstrom',
    })

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Exact lookup requires region, realmSlug, and characterName together.',
      },
    })
  })

  it('accepts character url only payload', () => {
    const result = validateWclCharacterResolveRequest({
      characterUrl: 'https://www.warcraftlogs.com/character/eu/the-maelstrom/bagge',
    })

    expect(result).toEqual({
      ok: true,
      request: {
        wclSite: undefined,
        characterUrl: 'https://www.warcraftlogs.com/character/eu/the-maelstrom/bagge',
        region: undefined,
        realmSlug: undefined,
        characterName: undefined,
      },
    })
  })
})

describe('resolveWclCharacter', () => {
  beforeEach(() => {
    mockedQueryWclGraphQl.mockReset()
  })

  it('uses URL-derived identity and adds mismatch warnings when explicit fields disagree', async () => {
    mockedQueryWclGraphQl.mockResolvedValueOnce({
      characterData: {
        character: {
          id: 80203972,
          canonicalID: 80203972,
          name: 'Bagge',
          level: 90,
          classID: 11,
          hidden: false,
          server: {
            name: 'The Maelstrom',
            slug: 'the-maelstrom',
            region: {
              slug: 'eu',
              name: 'Europe',
            },
          },
          faction: {
            name: 'Alliance',
          },
        },
      },
    })

    const result = await resolveWclCharacter(BASE_CONFIG, {
      wclSite: 'classic',
      characterUrl: 'https://www.warcraftlogs.com/character/eu/the-maelstrom/bagge',
      region: 'us',
      realmSlug: 'different-realm',
      characterName: 'DifferentName',
    })

    expect(result.status).toBe('resolved')
    expect(result.character).toMatchObject({
      source: 'url',
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
    })
    expect(result.warnings).toEqual([
      'characterUrl site "retail" overrides explicit site "classic".',
      'characterUrl region "eu" overrides explicit region "us".',
      'characterUrl realmSlug "the-maelstrom" overrides explicit realmSlug "different-realm".',
      'characterUrl characterName "bagge" overrides explicit characterName "DifferentName".',
    ])

    expect(mockedQueryWclGraphQl).toHaveBeenCalledWith(
      expect.objectContaining({
        site: 'retail',
        variables: {
          name: 'bagge',
          serverSlug: 'the-maelstrom',
          serverRegion: 'EU',
        },
      })
    )
  })

  it('resolves an exact lookup payload', async () => {
    mockedQueryWclGraphQl.mockResolvedValueOnce({
      characterData: {
        character: {
          id: 10,
          canonicalID: 11,
          name: '玩家',
          level: 80,
          classID: 8,
          hidden: false,
          server: {
            name: 'Azshara',
            slug: 'azshara',
            region: {
              slug: 'kr',
              name: 'Korea',
            },
          },
          faction: {
            name: 'Horde',
          },
        },
      },
    })

    const result = await resolveWclCharacter(BASE_CONFIG, {
      wclSite: 'classic',
      region: 'KR',
      realmSlug: 'Azshara',
      characterName: '玩家',
    })

    expect(result).toEqual({
      status: 'resolved',
      character: {
        source: 'exactLookup',
        site: 'classic',
        id: 11,
        name: '玩家',
        normalizedName: '玩家',
        region: 'kr',
        realmSlug: 'azshara',
        realmName: 'Azshara',
        canonicalUrl: 'https://classic.warcraftlogs.com/character/kr/azshara/%E7%8E%A9%E5%AE%B6',
        className: null,
        specName: null,
        faction: 'Horde',
        level: 80,
        warnings: [],
      },
      warnings: [],
    })
  })

  it('returns not_found when exact lookup returns no character', async () => {
    mockedQueryWclGraphQl.mockResolvedValueOnce({
      characterData: {
        character: null,
      },
    })

    const result = await resolveWclCharacter(BASE_CONFIG, {
      region: 'eu',
      realmSlug: 'the-maelstrom',
      characterName: 'NoSuchPlayer',
    })

    expect(result).toEqual({
      status: 'not_found',
      character: null,
      warnings: [],
    })
  })

  it('returns validation error when URL parsing fails', async () => {
    const result = await resolveWclCharacter(BASE_CONFIG, {
      characterUrl: 'https://example.com/character/eu/the-maelstrom/bagge',
    })

    expect(result).toEqual({
      status: 'error',
      character: null,
      warnings: [],
      error: {
        code: 'VALIDATION_ERROR',
        message:
          'characterUrl host is not supported. Allowed hosts: www.warcraftlogs.com, classic.warcraftlogs.com, fresh.warcraftlogs.com.',
      },
    })
  })

  it('classifies schema/query incompatibility as unsupported', async () => {
    mockedQueryWclGraphQl.mockRejectedValueOnce(
      new Error('WCL GraphQL returned errors: Cannot query field "character" on type "CharacterData".')
    )

    const result = await resolveWclCharacter(BASE_CONFIG, {
      region: 'eu',
      realmSlug: 'the-maelstrom',
      characterName: 'Bagge',
    })

    expect(result.status).toBe('unsupported')
    expect(result.error).toEqual({
      code: 'UNSUPPORTED_QUERY_SCHEMA',
      message: 'Exact character lookup is not supported by the selected Warcraft Logs site schema.',
      hint: 'Try a different WCL site or verify schema compatibility for this site.',
    })
  })

  it('classifies auth/site failures', async () => {
    mockedQueryWclGraphQl.mockRejectedValueOnce(
      new Error('WCL OAuth token request failed (401): unauthorized')
    )

    const result = await resolveWclCharacter(BASE_CONFIG, {
      region: 'eu',
      realmSlug: 'the-maelstrom',
      characterName: 'Bagge',
    })

    expect(result.status).toBe('error')
    expect(result.error).toEqual({
      code: 'AUTH_OR_SITE_FAILURE',
      message: 'Warcraft Logs authentication or site access failed during exact character lookup.',
      hint: 'Check server-side WCL credentials and selected WCL site.',
    })
  })
})
