import type { WclConfig } from './wcl-config'
import { getWclSiteConfig, type WclSite } from './wcl-site'

export type WclRequestContext = {
  wclSite?: WclSite | string | null
  guildId?: string | null
  region?: string | null
}

export type WclConfigWithSite = WclConfig & {
  WCL_SITE: WclSite
  WCL_GUILD_ID?: string
  WCL_REGION?: string
}

export type ResolvedWclRequestContext = {
  site: WclSite
  guildId?: string
  region?: string
  config: WclConfigWithSite
}

export const MISSING_GUILD_ID_ERROR_MESSAGE =
  'Guild ID is required for this flow. Add a Guild ID in Settings or configure WCL_GUILD_ID on the server.'

const pickFirstValue = (value: unknown): unknown =>
  Array.isArray(value) ? value[0] : value

const toTrimmedNonEmpty = (value: unknown): string | undefined => {
  const normalized = pickFirstValue(value)
  if (typeof normalized !== 'string') return undefined
  const trimmed = normalized.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const resolveWclRequestContext = (
  baseConfig: WclConfig,
  requestContext?: WclRequestContext | null
): ResolvedWclRequestContext => {
  const site = getWclSiteConfig(requestContext?.wclSite).site
  const guildId = toTrimmedNonEmpty(requestContext?.guildId) ?? baseConfig.WCL_GUILD_ID
  const region = toTrimmedNonEmpty(requestContext?.region) ?? baseConfig.WCL_REGION

  return {
    site,
    guildId,
    region,
    config: {
      ...baseConfig,
      WCL_GUILD_ID: guildId,
      WCL_REGION: region,
      WCL_SITE: site,
    },
  }
}

export const requireGuildIdForGuildScopedFlow = (guildId: string | undefined): string => {
  if (guildId && guildId.trim().length > 0) {
    return guildId.trim()
  }
  throw new Error(MISSING_GUILD_ID_ERROR_MESSAGE)
}
