import { DEFAULT_APP_SETTINGS, type AppSettings, type WclSite } from '@/features/settings/types/app-settings'

export const APP_SETTINGS_STORAGE_KEY = 'wcl-cmp.settings.v1'

const SITE_VALUES: WclSite[] = ['retail', 'classic', 'fresh']

const sanitizeText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const sanitizeSite = (value: unknown): WclSite | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return SITE_VALUES.includes(normalized as WclSite) ? (normalized as WclSite) : null
}

export const normalizeAppSettings = (input: unknown): AppSettings => {
  const obj = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}

  return {
    wclSite: sanitizeSite(obj['wclSite']),
    guildId: sanitizeText(obj['guildId']),
    region: sanitizeText(obj['region']),
    defaultRealm: sanitizeText(obj['defaultRealm']),
    defaultCharacter: sanitizeText(obj['defaultCharacter']),
  }
}

export const loadAppSettings = (): AppSettings => {
  if (typeof window === 'undefined') return { ...DEFAULT_APP_SETTINGS }

  try {
    const raw = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_APP_SETTINGS }
    return normalizeAppSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_APP_SETTINGS }
  }
}

export const saveAppSettings = (settings: AppSettings): AppSettings => {
  const normalized = normalizeAppSettings(settings)
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(normalized))
  }
  return normalized
}

export const clearAppSettings = (): void => {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(APP_SETTINGS_STORAGE_KEY)
  }
}

export const getEffectiveWclSite = (settings: Pick<AppSettings, 'wclSite'>): WclSite =>
  settings.wclSite ?? 'retail'

