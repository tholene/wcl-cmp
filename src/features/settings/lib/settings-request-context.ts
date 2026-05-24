import type { AppSettings } from '@/features/settings/types/app-settings'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import { getEffectiveWclSite } from './app-settings-storage'

const toOptionalTrimmed = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const buildSettingsRequestContext = (
  settings: Pick<AppSettings, 'wclSite' | 'guildId' | 'region'>
): AppSettingsRequestContext => {
  const guildId = toOptionalTrimmed(settings.guildId)
  const region = toOptionalTrimmed(settings.region)

  return {
    wclSite: getEffectiveWclSite(settings),
    ...(guildId ? { guildId } : {}),
    ...(region ? { region } : {}),
  }
}
