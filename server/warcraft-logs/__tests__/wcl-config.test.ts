import { afterEach, describe, expect, it, vi } from 'vitest'
import { getWclConfig } from '../wcl-config'

const setRequiredWclSecrets = (): void => {
  vi.stubEnv('WCL_CLIENT_ID', 'test-client-id')
  vi.stubEnv('WCL_CLIENT_SECRET', 'test-client-secret')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('getWclConfig', () => {
  it('returns parsed config when required env vars are present', () => {
    setRequiredWclSecrets()
    vi.stubEnv('WCL_GUILD_ID', '98765')
    vi.stubEnv('WCL_REGION', 'US')
    vi.stubEnv('WCL_REDIRECT_URI', 'https://example.test/auth/callback')
    vi.stubEnv('API_PORT', '6001')

    const config = getWclConfig()

    expect(config).toEqual({
      WCL_CLIENT_ID: 'test-client-id',
      WCL_CLIENT_SECRET: 'test-client-secret',
      WCL_GUILD_ID: '98765',
      WCL_REGION: 'US',
      WCL_REDIRECT_URI: 'https://example.test/auth/callback',
      API_PORT: 6001,
    })
  })

  it('applies defaults for optional fields', () => {
    setRequiredWclSecrets()
    vi.stubEnv('WCL_GUILD_ID', undefined)
    vi.stubEnv('WCL_REGION', undefined)
    vi.stubEnv('WCL_REDIRECT_URI', undefined)
    vi.stubEnv('API_PORT', undefined)

    const config = getWclConfig()

    expect(config.WCL_GUILD_ID).toBeUndefined()
    expect(config.WCL_REGION).toBeUndefined()
    expect(config.WCL_REDIRECT_URI).toBe('http://localhost:5781/auth/callback')
    expect(config.API_PORT).toBe(5781)
  })

  it('throws when WCL_CLIENT_ID is missing or empty', () => {
    vi.stubEnv('WCL_CLIENT_ID', '')
    vi.stubEnv('WCL_CLIENT_SECRET', 'present')

    expect(() => getWclConfig()).toThrow('Invalid environment configuration')
    expect(() => getWclConfig()).toThrow('WCL_CLIENT_ID is missing or empty')
  })

  it('throws when WCL_CLIENT_SECRET is missing or empty', () => {
    vi.stubEnv('WCL_CLIENT_ID', 'present')
    vi.stubEnv('WCL_CLIENT_SECRET', '')

    expect(() => getWclConfig()).toThrow('Invalid environment configuration')
    expect(() => getWclConfig()).toThrow('WCL_CLIENT_SECRET is missing or empty')
  })

  it('throws when WCL_REDIRECT_URI is invalid', () => {
    setRequiredWclSecrets()
    vi.stubEnv('WCL_REDIRECT_URI', 'not a url')

    expect(() => getWclConfig()).toThrow('WCL_REDIRECT_URI is invalid (must be a URL)')
  })
})
