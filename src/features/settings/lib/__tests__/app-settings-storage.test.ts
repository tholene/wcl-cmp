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
        defaultCharacter: '  Fink ',
      })
    ).toEqual({
      wclSite: null,
      guildId: '61324',
      region: null,
      defaultRealm: null,
      defaultCharacter: 'Fink',
    })
  })

  it('loads and sanitizes persisted settings', () => {
    window.localStorage.setItem(
      APP_SETTINGS_STORAGE_KEY,
      JSON.stringify({
        wclSite: 'classic',
        guildId: '  61324 ',
        region: 'EU',
        defaultRealm: 'Ragnaros',
        defaultCharacter: 'Mini',
      })
    )

    expect(loadAppSettings()).toEqual({
      wclSite: 'classic',
      guildId: '61324',
      region: 'EU',
      defaultRealm: 'Ragnaros',
      defaultCharacter: 'Mini',
    })
  })

  it('saves normalized settings to localStorage', () => {
    const saved = saveAppSettings({
      wclSite: 'fresh',
      guildId: '  ',
      region: ' us ',
      defaultRealm: '  ragnaros ',
      defaultCharacter: '  Katie ',
    })

    expect(saved).toEqual({
      wclSite: 'fresh',
      guildId: null,
      region: 'us',
      defaultRealm: 'ragnaros',
      defaultCharacter: 'Katie',
    })

    expect(JSON.parse(window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY) ?? '{}')).toEqual(saved)
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
