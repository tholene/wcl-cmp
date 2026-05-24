import { describe, expect, it } from 'vitest'
import {
  buildWclCharacterIdUrl,
  buildWclCharacterUrl,
  buildWclReportUrl,
  getWclGraphQlUrl,
  getWclSiteConfig,
  getWclTokenUrl,
} from '../wcl-site'

describe('wcl-site', () => {
  it('uses retail as the default site', () => {
    expect(getWclSiteConfig()).toEqual({
      site: 'retail',
      host: 'www.warcraftlogs.com',
      label: 'Retail',
    })
    expect(getWclGraphQlUrl()).toBe('https://www.warcraftlogs.com/api/v2/client')
    expect(getWclTokenUrl()).toBe('https://www.warcraftlogs.com/oauth/token')
  })

  it('returns classic host and endpoint URLs', () => {
    expect(getWclSiteConfig('classic')).toEqual({
      site: 'classic',
      host: 'classic.warcraftlogs.com',
      label: 'Classic',
    })
    expect(getWclGraphQlUrl('classic')).toBe('https://classic.warcraftlogs.com/api/v2/client')
    expect(getWclTokenUrl('classic')).toBe('https://classic.warcraftlogs.com/oauth/token')
  })

  it('returns fresh host and endpoint URLs', () => {
    expect(getWclSiteConfig('fresh')).toEqual({
      site: 'fresh',
      host: 'fresh.warcraftlogs.com',
      label: 'Fresh',
    })
    expect(getWclGraphQlUrl('fresh')).toBe('https://fresh.warcraftlogs.com/api/v2/client')
    expect(getWclTokenUrl('fresh')).toBe('https://fresh.warcraftlogs.com/oauth/token')
  })

  it('falls back to retail for unknown site values', () => {
    expect(getWclSiteConfig('unexpected-site')).toEqual({
      site: 'retail',
      host: 'www.warcraftlogs.com',
      label: 'Retail',
    })
  })

  it('builds report URLs', () => {
    expect(buildWclReportUrl('retail', 'abc123')).toBe('https://www.warcraftlogs.com/reports/abc123')
    expect(buildWclReportUrl('classic', 'abc123')).toBe('https://classic.warcraftlogs.com/reports/abc123')
    expect(buildWclReportUrl('fresh', 'abc123')).toBe('https://fresh.warcraftlogs.com/reports/abc123')
  })

  it('builds character URLs', () => {
    expect(buildWclCharacterUrl('classic', 'EU', 'Ragnaros', 'Mini Scholes')).toBe(
      'https://classic.warcraftlogs.com/character/eu/ragnaros/Mini%20Scholes'
    )
    expect(buildWclCharacterIdUrl('fresh', 123456)).toBe('https://fresh.warcraftlogs.com/character/id/123456')
  })
})

