import { describe, expect, it } from 'vitest'
import {
  buildGlobalBossKillsRequest,
  getDefaultPlayerLookupMode,
  hasConfiguredGuildId,
} from '../player-lookup-mode'

describe('player lookup mode defaults', () => {
  it('defaults to guild when guildId exists', () => {
    expect(getDefaultPlayerLookupMode({ guildId: '61324' })).toBe('guild')
    expect(hasConfiguredGuildId({ guildId: '61324' })).toBe(true)
  })

  it('defaults to global when guildId is missing', () => {
    expect(getDefaultPlayerLookupMode({ guildId: undefined })).toBe('global')
    expect(getDefaultPlayerLookupMode({ guildId: '  ' })).toBe('global')
    expect(hasConfiguredGuildId({ guildId: '  ' })).toBe(false)
  })
})

describe('buildGlobalBossKillsRequest', () => {
  const context = { wclSite: 'retail' as const }

  it('builds URL-first requests when characterUrl is present', () => {
    const built = buildGlobalBossKillsRequest(context, {
      characterUrl: ' https://www.warcraftlogs.com/character/eu/the-maelstrom/bagge ',
      region: 'US',
      realmSlug: 'illidan',
      characterName: 'Bagge',
      includeWipes: false,
      limit: 10,
    })

    expect(built).toEqual({
      ok: true,
      request: {
        wclSite: 'retail',
        characterUrl: 'https://www.warcraftlogs.com/character/eu/the-maelstrom/bagge',
        includeWipes: false,
        limit: 10,
      },
    })
  })

  it('builds exact tuple requests when URL is missing', () => {
    const built = buildGlobalBossKillsRequest(context, {
      characterUrl: '',
      region: ' eu ',
      realmSlug: ' the-maelstrom ',
      characterName: ' Bagge ',
      includeWipes: true,
      limit: 20,
    })

    expect(built).toEqual({
      ok: true,
      request: {
        wclSite: 'retail',
        characterName: 'Bagge',
        region: 'eu',
        realmSlug: 'the-maelstrom',
        includeWipes: true,
        limit: 20,
      },
    })
  })

  it('returns validation error when both URL and exact tuple are incomplete', () => {
    const built = buildGlobalBossKillsRequest(context, {
      characterUrl: '',
      region: 'eu',
      realmSlug: '',
      characterName: '',
      includeWipes: false,
      limit: 10,
    })

    expect(built).toEqual({
      ok: false,
      error: 'Paste a Warcraft Logs character URL or provide character name, region, and realm slug.',
    })
  })
})
