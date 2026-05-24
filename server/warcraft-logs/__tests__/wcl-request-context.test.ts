import { describe, expect, it } from 'vitest'
import {
  MISSING_GUILD_ID_ERROR_MESSAGE,
  requireGuildIdForGuildScopedFlow,
  resolveWclRequestContext,
  type WclRequestContext,
} from '../wcl-request-context'
import type { WclConfig } from '../wcl-config'

const BASE_CONFIG: WclConfig = {
  WCL_CLIENT_ID: 'client-id',
  WCL_CLIENT_SECRET: 'client-secret',
  WCL_GUILD_ID: 'env-guild',
  WCL_REGION: 'US',
  WCL_REDIRECT_URI: 'http://localhost:5781/auth/callback',
  API_PORT: 5781,
}

describe('resolveWclRequestContext', () => {
  it('uses env values when request context is missing', () => {
    const resolved = resolveWclRequestContext(BASE_CONFIG)

    expect(resolved.site).toBe('retail')
    expect(resolved.guildId).toBe('env-guild')
    expect(resolved.region).toBe('US')
    expect(resolved.config.WCL_SITE).toBe('retail')
    expect(resolved.config.WCL_GUILD_ID).toBe('env-guild')
    expect(resolved.config.WCL_REGION).toBe('US')
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

  it('request context guildId override wins over env', () => {
    const resolved = resolveWclRequestContext(BASE_CONFIG, { guildId: ' 99887 ' })
    expect(resolved.guildId).toBe('99887')
    expect(resolved.config.WCL_GUILD_ID).toBe('99887')
  })

  it('request context region override wins over env', () => {
    const resolved = resolveWclRequestContext(BASE_CONFIG, { region: ' US ' })
    expect(resolved.region).toBe('US')
    expect(resolved.config.WCL_REGION).toBe('US')
  })

  it('uses env values when request overrides are empty', () => {
    const context: WclRequestContext = { guildId: ' ', region: '' }
    const resolved = resolveWclRequestContext(BASE_CONFIG, context)
    expect(resolved.guildId).toBe('env-guild')
    expect(resolved.region).toBe('US')
  })

  it('keeps guildId and region undefined when both request and env are missing', () => {
    const withoutEnv: WclConfig = {
      ...BASE_CONFIG,
      WCL_GUILD_ID: undefined,
      WCL_REGION: undefined,
    }
    const resolved = resolveWclRequestContext(withoutEnv, { guildId: ' ', region: '' })
    expect(resolved.guildId).toBeUndefined()
    expect(resolved.region).toBeUndefined()
    expect(resolved.config.WCL_GUILD_ID).toBeUndefined()
    expect(resolved.config.WCL_REGION).toBeUndefined()
  })
})

describe('requireGuildIdForGuildScopedFlow', () => {
  it('returns trimmed guild id when present', () => {
    expect(requireGuildIdForGuildScopedFlow(' 61324 ')).toBe('61324')
  })

  it('throws the required clear error when guild id is missing', () => {
    expect(() => requireGuildIdForGuildScopedFlow(undefined)).toThrow(MISSING_GUILD_ID_ERROR_MESSAGE)
  })
})
