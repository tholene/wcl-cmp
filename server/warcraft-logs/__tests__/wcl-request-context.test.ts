import { describe, expect, it } from 'vitest'
import { resolveWclRequestContext, type WclRequestContext } from '../wcl-request-context'
import type { WclConfig } from '../wcl-config'

const BASE_CONFIG: WclConfig = {
  WCL_CLIENT_ID: 'client-id',
  WCL_CLIENT_SECRET: 'client-secret',
  WCL_GUILD_ID: '61324',
  WCL_REGION: 'EU',
  WCL_REDIRECT_URI: 'http://localhost:5781/auth/callback',
  API_PORT: 5781,
}

describe('resolveWclRequestContext', () => {
  it('uses defaults when request context is missing', () => {
    const resolved = resolveWclRequestContext(BASE_CONFIG)

    expect(resolved.site).toBe('retail')
    expect(resolved.guildId).toBe('61324')
    expect(resolved.region).toBe('EU')
    expect(resolved.config.WCL_SITE).toBe('retail')
    expect(resolved.config.WCL_GUILD_ID).toBe('61324')
    expect(resolved.config.WCL_REGION).toBe('EU')
  })

  it('respects selected site when valid', () => {
    const resolved = resolveWclRequestContext(BASE_CONFIG, { wclSite: 'classic' })
    expect(resolved.site).toBe('classic')
    expect(resolved.config.WCL_SITE).toBe('classic')
  })

  it('falls back to retail for invalid site values', () => {
    const resolved = resolveWclRequestContext(BASE_CONFIG, { wclSite: 'invalid-site' })
    expect(resolved.site).toBe('retail')
    expect(resolved.config.WCL_SITE).toBe('retail')
  })

  it('applies guildId override when provided', () => {
    const resolved = resolveWclRequestContext(BASE_CONFIG, { guildId: ' 99887 ' })
    expect(resolved.guildId).toBe('99887')
    expect(resolved.config.WCL_GUILD_ID).toBe('99887')
  })

  it('applies region override when provided', () => {
    const resolved = resolveWclRequestContext(BASE_CONFIG, { region: ' US ' })
    expect(resolved.region).toBe('US')
    expect(resolved.config.WCL_REGION).toBe('US')
  })

  it('ignores empty guildId/region overrides', () => {
    const context: WclRequestContext = { guildId: ' ', region: '' }
    const resolved = resolveWclRequestContext(BASE_CONFIG, context)
    expect(resolved.guildId).toBe('61324')
    expect(resolved.region).toBe('EU')
  })
})
