import { describe, expect, it } from 'vitest'
import { parseWclCharacterUrl } from '../wcl-character-url'

describe('parseWclCharacterUrl', () => {
  it('parses retail character URLs', () => {
    const result = parseWclCharacterUrl('https://www.warcraftlogs.com/character/eu/the-maelstrom/bagge')

    expect(result).toEqual({
      ok: true,
      value: {
        site: 'retail',
        region: 'eu',
        realmSlug: 'the-maelstrom',
        characterName: 'bagge',
        canonicalUrl: 'https://www.warcraftlogs.com/character/eu/the-maelstrom/bagge',
      },
      warnings: [],
    })
  })

  it('parses classic character URLs', () => {
    const result = parseWclCharacterUrl('https://classic.warcraftlogs.com/character/eu/some-realm/somecharacter')

    expect(result).toEqual({
      ok: true,
      value: {
        site: 'classic',
        region: 'eu',
        realmSlug: 'some-realm',
        characterName: 'somecharacter',
        canonicalUrl: 'https://classic.warcraftlogs.com/character/eu/some-realm/somecharacter',
      },
      warnings: [],
    })
  })

  it('parses fresh character URLs', () => {
    const result = parseWclCharacterUrl('https://fresh.warcraftlogs.com/character/us/living-flame/testplayer')

    expect(result).toEqual({
      ok: true,
      value: {
        site: 'fresh',
        region: 'us',
        realmSlug: 'living-flame',
        characterName: 'testplayer',
        canonicalUrl: 'https://fresh.warcraftlogs.com/character/us/living-flame/testplayer',
      },
      warnings: [],
    })
  })

  it('rejects unsupported hosts', () => {
    const result = parseWclCharacterUrl('https://example.com/character/eu/the-maelstrom/bagge')

    expect(result).toEqual({
      ok: false,
      code: 'UNSUPPORTED_HOST',
      message:
        'characterUrl host is not supported. Allowed hosts: www.warcraftlogs.com, classic.warcraftlogs.com, fresh.warcraftlogs.com.',
    })
  })

  it('rejects malformed URLs', () => {
    const result = parseWclCharacterUrl('not-a-url')

    expect(result).toEqual({
      ok: false,
      code: 'INVALID_URL',
      message: 'characterUrl must be a valid absolute URL.',
    })
  })

  it('preserves non-latin character names', () => {
    const result = parseWclCharacterUrl('https://www.warcraftlogs.com/character/kr/azshara/%E7%8B%BC%E4%BA%BA')

    expect(result).toEqual({
      ok: true,
      value: {
        site: 'retail',
        region: 'kr',
        realmSlug: 'azshara',
        characterName: '狼人',
        canonicalUrl: 'https://www.warcraftlogs.com/character/kr/azshara/%E7%8B%BC%E4%BA%BA',
      },
      warnings: [],
    })
  })

  it('supports realm slugs with hyphens', () => {
    const result = parseWclCharacterUrl('https://www.warcraftlogs.com/character/eu/tarren-mill/Example')

    expect(result).toEqual({
      ok: true,
      value: {
        site: 'retail',
        region: 'eu',
        realmSlug: 'tarren-mill',
        characterName: 'Example',
        canonicalUrl: 'https://www.warcraftlogs.com/character/eu/tarren-mill/Example',
      },
      warnings: [],
    })
  })
})
