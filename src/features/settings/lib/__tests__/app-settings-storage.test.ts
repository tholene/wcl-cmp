import { beforeEach, describe, expect, it } from 'vitest'
import {
  APP_SETTINGS_STORAGE_KEY,
  clearAppSettings,
  getEffectiveWclSite,
  loadAppSettings,
  normalizeAppSettings,
  saveAppSettings,
} from '@/features/settings/lib/app-settings-storage'
import { DEFAULT_APP_SETTINGS } from '@/features/settings/types/app-settings'

describe('app-settings-storage', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('returns defaults when localStorage is empty', () => {
    expect(loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS)
    expect(DEFAULT_APP_SETTINGS).not.toHaveProperty('defaultCharacter')
  })

  it('returns defaults when localStorage JSON is corrupt', () => {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, '{broken')
    expect(loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS)
  })

  it('normalizes unknown values safely', () => {
    expect(
      normalizeAppSettings({
        wclSite: 'invalid-site',
        guildId: '  61324  ',
        region: '',
        defaultRealm: 42,
      })
    ).toEqual({
      wclSite: null,
      guildId: '61324',
      region: null,
      defaultRealm: null,
    })
  })

  it('drops legacy defaultCharacter from old stored payloads', () => {
    window.localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        wclSite: 'retail',
        guildId: '61324',
        region: 'EU',
        defaultRealm: 'Ragnaros',
        defaultCharacter: 'LegacyName',
      })
    )

    const loaded = loadAppSettings()

    expect(loaded).toEqual({
      wclSite: 'retail',
      guildId: '61324',
      region: 'EU',
      defaultRealm: 'Ragnaros',
    })
    expect(JSON.parse(JSON.stringify(loaded))).not.toHaveProperty('defaultCharacter')
  })

  it('loads and sanitizes persisted settings', () => {
    window.localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        wclSite: 'classic',
        guildId: '  61324 ',
        region: 'EU',
        defaultRealm: 'Ragnaros',
      })
    )

    expect(loadAppSettings()).toEqual({
      wclSite: 'classic',
      guildId: '61324',
      region: 'EU',
      defaultRealm: 'Ragnaros',
    })
  })

  it('saves normalized settings to localStorage', () => {
    const saved = saveAppSettings({
      wclSite: 'fresh',
      guildId: '  ',
      region: ' us ',
      defaultRealm: '  ragnaros ',
    })

    expect(saved).toEqual({
      wclSite: 'fresh',
      guildId: null,
      region: 'us',
      defaultRealm: 'ragnaros',
    })

    const persisted = JSON.parse(window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY) ?? '{}')
    expect(persisted).toEqual(saved)
    expect(persisted).not.toHaveProperty('defaultCharacter')
  })

  it('clears persisted settings', () => {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify({ wclSite: 'retail' }))
    clearAppSettings()
    expect(window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY)).toBeNull()
  })

  it('falls back to retail for effective site when explicit site is missing', () => {
    expect(getEffectiveWclSite({ wclSite: null })).toBe('retail')
    expect(getEffectiveWclSite({ wclSite: 'fresh' })).toBe('fresh')
  })
})
