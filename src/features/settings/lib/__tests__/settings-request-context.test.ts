import { describe, expect, it } from 'vitest'
import { buildSettingsRequestContext } from '../settings-request-context'

describe('buildSettingsRequestContext', () => {
  it('falls back to retail when site is null', () => {
    const context = buildSettingsRequestContext({
      wclSite: null,
      guildId: null,
      region: null,
    })

    expect(context).toEqual({ wclSite: 'retail' })
    expect(context).not.toHaveProperty('defaultCharacter')
    expect(context).not.toHaveProperty('defaultRealm')
  })

  it('trims and includes optional guild and region', () => {
    const context = buildSettingsRequestContext({
      wclSite: 'classic',
      guildId: ' 61324 ',
      region: ' EU ',
    })

    expect(context).toEqual({
      wclSite: 'classic',
      guildId: '61324',
      region: 'EU',
    })
    expect(context).not.toHaveProperty('defaultCharacter')
    expect(context).not.toHaveProperty('defaultRealm')
  })

  it('omits empty optional fields', () => {
    const context = buildSettingsRequestContext({
      wclSite: 'fresh',
      guildId: '   ',
      region: '',
    })

    expect(context).toEqual({
      wclSite: 'fresh',
    })
  })
})
