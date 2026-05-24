export type WclSite = 'retail' | 'classic' | 'fresh'

type WclSiteHostConfig = {
  host: string
  label: string
}

export type WclSiteConfig = WclSiteHostConfig & {
  site: WclSite
}

const DEFAULT_WCL_SITE: WclSite = 'retail'

const WCL_SITE_HOSTS: Record<WclSite, WclSiteHostConfig> = {
  retail: {
    host: 'www.warcraftlogs.com',
    label: 'Retail',
  },
  classic: {
    host: 'classic.warcraftlogs.com',
    label: 'Classic',
  },
  fresh: {
    host: 'fresh.warcraftlogs.com',
    label: 'Fresh',
  },
}

const resolveWclSite = (site?: WclSite | string | null): WclSite => {
  if (!site) return DEFAULT_WCL_SITE
  const normalized = String(site).trim().toLowerCase()

  if (normalized === 'retail' || normalized === 'classic' || normalized === 'fresh') {
    return normalized
  }

  return DEFAULT_WCL_SITE
}

export const getWclSiteConfig = (site?: WclSite | string | null): WclSiteConfig => {
  const resolvedSite = resolveWclSite(site)
  return {
    site: resolvedSite,
    ...WCL_SITE_HOSTS[resolvedSite],
  }
}

export const getWclGraphQlUrl = (site?: WclSite | string | null): string => {
  const { host } = getWclSiteConfig(site)
  return `https://${host}/api/v2/client`
}

export const getWclTokenUrl = (site?: WclSite | string | null): string => {
  const { host } = getWclSiteConfig(site)
  return `https://${host}/oauth/token`
}

export const buildWclReportUrl = (site: WclSite | string | null | undefined, reportCode: string): string => {
  const { host } = getWclSiteConfig(site)
  return `https://${host}/reports/${reportCode}`
}

export const buildWclCharacterUrl = (
  site: WclSite | string | null | undefined,
  region: string,
  realmSlug: string,
  characterName: string
): string => {
  const { host } = getWclSiteConfig(site)
  return `https://${host}/character/${region.toLowerCase()}/${realmSlug.toLowerCase()}/${encodeURIComponent(characterName)}`
}

export const buildWclCharacterIdUrl = (
  site: WclSite | string | null | undefined,
  characterId: number
): string => {
  const { host } = getWclSiteConfig(site)
  return `https://${host}/character/id/${characterId}`
}

