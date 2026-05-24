export type WclSite = 'retail' | 'classic' | 'fresh'

export type AppSettings = {
  wclSite: WclSite | null
  guildId: string | null
  region: string | null
  defaultRealm: string | null
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  wclSite: null,
  guildId: null,
  region: null,
  defaultRealm: null,
}
