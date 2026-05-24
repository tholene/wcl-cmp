import { buildWclCharacterUrl, getWclSiteConfig, type WclSite } from './wcl-site'

const ALLOWED_WCL_HOSTS: Record<string, WclSite> = {
  'www.warcraftlogs.com': 'retail',
  'classic.warcraftlogs.com': 'classic',
  'fresh.warcraftlogs.com': 'fresh',
}

export type ParsedWclCharacterUrl = {
  site: WclSite
  region: string
  realmSlug: string
  characterName: string
  canonicalUrl: string
}

export type ParseWclCharacterUrlResult =
  | {
      ok: true
      value: ParsedWclCharacterUrl
      warnings: string[]
    }
  | {
      ok: false
      code: 'INVALID_URL' | 'UNSUPPORTED_HOST' | 'INVALID_PATH'
      message: string
    }

const decodePathSegment = (value: string): string | null => {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

const toNonEmptyValue = (value: string): string | null => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export const parseWclCharacterUrl = (input: string): ParseWclCharacterUrlResult => {
  let parsedUrl: URL

  try {
    parsedUrl = new URL(input)
  } catch {
    return {
      ok: false,
      code: 'INVALID_URL',
      message: 'characterUrl must be a valid absolute URL.',
    }
  }

  const site = ALLOWED_WCL_HOSTS[parsedUrl.hostname]
  if (!site) {
    return {
      ok: false,
      code: 'UNSUPPORTED_HOST',
      message:
        'characterUrl host is not supported. Allowed hosts: www.warcraftlogs.com, classic.warcraftlogs.com, fresh.warcraftlogs.com.',
    }
  }

  const pathSegments = parsedUrl.pathname.split('/').filter((segment) => segment.length > 0)
  if (pathSegments.length !== 4 || pathSegments[0] !== 'character') {
    return {
      ok: false,
      code: 'INVALID_PATH',
      message: 'characterUrl must match /character/<region>/<realmSlug>/<characterName>.',
    }
  }

  const decodedRegion = decodePathSegment(pathSegments[1])
  const decodedRealmSlug = decodePathSegment(pathSegments[2])
  const decodedCharacterName = decodePathSegment(pathSegments[3])

  if (!decodedRegion || !decodedRealmSlug || !decodedCharacterName) {
    return {
      ok: false,
      code: 'INVALID_PATH',
      message: 'characterUrl contains invalid URL-encoded path segments.',
    }
  }

  const region = toNonEmptyValue(decodedRegion)
  const realmSlug = toNonEmptyValue(decodedRealmSlug)
  const characterName = toNonEmptyValue(decodedCharacterName)

  if (!region || !realmSlug || !characterName) {
    return {
      ok: false,
      code: 'INVALID_PATH',
      message: 'characterUrl path segments cannot be empty.',
    }
  }

  return {
    ok: true,
    value: {
      site: getWclSiteConfig(site).site,
      region: region.toLowerCase(),
      realmSlug: realmSlug.toLowerCase(),
      characterName,
      canonicalUrl: buildWclCharacterUrl(site, region, realmSlug, characterName),
    },
    warnings: [],
  }
}
