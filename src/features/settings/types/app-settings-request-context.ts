import type { WclSite } from './app-settings'

export type AppSettingsRequestContext = {
  wclSite: WclSite
  guildId?: string
  region?: string
}
