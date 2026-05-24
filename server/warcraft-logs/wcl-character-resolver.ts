import { queryWclGraphQl } from './wcl-client'
import type { WclConfig } from './wcl-config'
import {
  type WclCharacterResolveRequest,
  type WclCharacterResolveResult,
  type WclCharacterResolveError,
} from './wcl-character-resolver.types'
import { parseWclCharacterUrl } from './wcl-character-url'
import { buildWclCharacterUrl, getWclSiteConfig } from './wcl-site'

const CHARACTER_EXACT_LOOKUP_QUERY = `
  query CharacterExactLookup($name: String!, $serverSlug: String!, $serverRegion: String!) {
    characterData {
      character(name: $name, serverSlug: $serverSlug, serverRegion: $serverRegion) {
        id
        canonicalID
        name
        level
        hidden
        classID
        server {
          name
          slug
          region {
            slug
            name
          }
        }
        faction {
          name
        }
      }
    }
  }
`

type CharacterExactLookupResponse = {
  characterData?: {
    character?: {
      id?: number | null
      canonicalID?: number | null
      name?: string | null
      level?: number | null
      classID?: number | null
      hidden?: boolean | null
      server?: {
        name?: string | null
        slug?: string | null
        region?: {
          slug?: string | null
          name?: string | null
        } | null
      } | null
      faction?: {
        name?: string | null
      } | null
    } | null
  }
}

type ResolveInputValidation =
  | {
      ok: true
      request: {
        wclSite?: string
        characterUrl?: string
        region?: string
        realmSlug?: string
        characterName?: string
      }
    }
  | {
      ok: false
      error: WclCharacterResolveError
    }

type EffectiveCharacterIdentity = {
  site: ReturnType<typeof getWclSiteConfig>['site']
  region: string
  realmSlug: string
  characterName: string
  source: 'url' | 'exactLookup'
}

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const normalizeRegionForLookup = (region: string): string => region.trim().toUpperCase()

const normalizeRegionForUrl = (region: string): string => region.trim().toLowerCase()

const normalizeRealmSlug = (realmSlug: string): string => realmSlug.trim().toLowerCase()

const normalizeCharacterName = (name: string): string => name.trim()

const asNormalizedName = (name: string): string => name.trim().toLowerCase()

const toResolveError = (
  code: WclCharacterResolveError['code'],
  message: string,
  hint?: string
): WclCharacterResolveError => ({ code, message, ...(hint ? { hint } : {}) })

export const validateWclCharacterResolveRequest = (
  request: WclCharacterResolveRequest
): ResolveInputValidation => {
  const characterUrl = normalizeText(request.characterUrl)
  const region = normalizeText(request.region)
  const realmSlug = normalizeText(request.realmSlug)
  const characterName = normalizeText(request.characterName)

  const hasUrl = Boolean(characterUrl)
  const exactFields = [region, realmSlug, characterName]
  const exactFieldCount = exactFields.filter(Boolean).length

  if (!hasUrl && exactFieldCount === 0) {
    return {
      ok: false,
      error: toResolveError(
        'VALIDATION_ERROR',
        'Provide either characterUrl or the exact tuple: region, realmSlug, and characterName.'
      ),
    }
  }

  if (!hasUrl && exactFieldCount > 0 && exactFieldCount < 3) {
    return {
      ok: false,
      error: toResolveError(
        'VALIDATION_ERROR',
        'Exact lookup requires region, realmSlug, and characterName together.'
      ),
    }
  }

  return {
    ok: true,
    request: {
      wclSite: normalizeText(request.wclSite),
      characterUrl,
      region,
      realmSlug,
      characterName,
    },
  }
}

const classifyLookupFailure = (error: unknown): WclCharacterResolveError => {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown resolver error')
  const normalized = message.toLowerCase()

  if (
    normalized.includes('graphql returned errors') &&
    (normalized.includes('cannot query field') ||
      normalized.includes('unknown argument') ||
      normalized.includes('syntax error') ||
      normalized.includes('validation error'))
  ) {
    return toResolveError(
      'UNSUPPORTED_QUERY_SCHEMA',
      'Exact character lookup is not supported by the selected Warcraft Logs site schema.',
      'Try a different WCL site or verify schema compatibility for this site.'
    )
  }

  if (
    normalized.includes('oauth token request failed') ||
    normalized.includes('authentication failed') ||
    normalized.includes('invalid_client') ||
    normalized.includes('unauthorized') ||
    normalized.includes('forbidden') ||
    normalized.includes('graphql request failed (401') ||
    normalized.includes('graphql request failed (403')
  ) {
    return toResolveError(
      'AUTH_OR_SITE_FAILURE',
      'Warcraft Logs authentication or site access failed during exact character lookup.',
      'Check server-side WCL credentials and selected WCL site.'
    )
  }

  return toResolveError(
    'UNKNOWN_LOOKUP_FAILURE',
    'Exact character lookup failed due to an unexpected error.',
    message
  )
}

const buildMismatchWarning = (field: string, urlValue: string, explicitValue: string): string =>
  `characterUrl ${field} "${urlValue}" overrides explicit ${field} "${explicitValue}".`

const resolveEffectiveIdentity = (
  request: ResolveInputValidation & { ok: true }
): { identity: EffectiveCharacterIdentity; warnings: string[] } | { error: WclCharacterResolveError } => {
  const warnings: string[] = []

  if (request.request.characterUrl) {
    const parsed = parseWclCharacterUrl(request.request.characterUrl)
    if (!parsed.ok) {
      return {
        error: toResolveError('VALIDATION_ERROR', parsed.message),
      }
    }

    const explicitSite = request.request.wclSite
    if (explicitSite) {
      const normalizedExplicitSite = getWclSiteConfig(explicitSite).site
      if (normalizedExplicitSite !== parsed.value.site) {
        warnings.push(
          buildMismatchWarning('site', parsed.value.site, normalizedExplicitSite)
        )
      }
    }

    if (request.request.region) {
      const normalizedExplicitRegion = normalizeRegionForUrl(request.request.region)
      if (normalizedExplicitRegion !== parsed.value.region) {
        warnings.push(
          buildMismatchWarning('region', parsed.value.region, normalizedExplicitRegion)
        )
      }
    }

    if (request.request.realmSlug) {
      const normalizedExplicitRealmSlug = normalizeRealmSlug(request.request.realmSlug)
      if (normalizedExplicitRealmSlug !== parsed.value.realmSlug) {
        warnings.push(
          buildMismatchWarning('realmSlug', parsed.value.realmSlug, normalizedExplicitRealmSlug)
        )
      }
    }

    if (request.request.characterName) {
      const normalizedExplicitCharacter = normalizeCharacterName(request.request.characterName)
      if (normalizedExplicitCharacter !== parsed.value.characterName) {
        warnings.push(
          buildMismatchWarning('characterName', parsed.value.characterName, normalizedExplicitCharacter)
        )
      }
    }

    return {
      identity: {
        site: parsed.value.site,
        region: parsed.value.region,
        realmSlug: parsed.value.realmSlug,
        characterName: parsed.value.characterName,
        source: 'url',
      },
      warnings,
    }
  }

  const site = getWclSiteConfig(request.request.wclSite).site
  const region = request.request.region
  const realmSlug = request.request.realmSlug
  const characterName = request.request.characterName

  if (!region || !realmSlug || !characterName) {
    return {
      error: toResolveError(
        'VALIDATION_ERROR',
        'Exact lookup requires region, realmSlug, and characterName.'
      ),
    }
  }

  return {
    identity: {
      site,
      region: normalizeRegionForUrl(region),
      realmSlug: normalizeRealmSlug(realmSlug),
      characterName: normalizeCharacterName(characterName),
      source: 'exactLookup',
    },
    warnings,
  }
}

const buildCharacterNotFoundResult = (warnings: string[]): WclCharacterResolveResult => ({
  status: 'not_found',
  character: null,
  warnings,
})

export const resolveWclCharacter = async (
  config: WclConfig,
  request: WclCharacterResolveRequest
): Promise<WclCharacterResolveResult> => {
  const validated = validateWclCharacterResolveRequest(request)
  if (!validated.ok) {
    return {
      status: 'error',
      character: null,
      warnings: [],
      error: validated.error,
    }
  }

  const resolvedIdentity = resolveEffectiveIdentity(validated)
  if ('error' in resolvedIdentity) {
    return {
      status: 'error',
      character: null,
      warnings: [],
      error: resolvedIdentity.error,
    }
  }

  const { identity, warnings } = resolvedIdentity

  try {
    const data = await queryWclGraphQl<CharacterExactLookupResponse>({
      config,
      site: identity.site,
      query: CHARACTER_EXACT_LOOKUP_QUERY,
      variables: {
        name: identity.characterName,
        serverSlug: identity.realmSlug,
        serverRegion: normalizeRegionForLookup(identity.region),
      },
    })

    const character = data.characterData?.character
    if (!character) {
      return buildCharacterNotFoundResult(warnings)
    }

    const resolvedName = normalizeCharacterName(character.name ?? identity.characterName)
    const resolvedRealmSlug = normalizeRealmSlug(character.server?.slug ?? identity.realmSlug)
    const resolvedRealmName = character.server?.name ?? null
    const resolvedRegion = normalizeRegionForUrl(character.server?.region?.slug ?? identity.region)
    const canonicalUrl = buildWclCharacterUrl(
      identity.site,
      resolvedRegion,
      resolvedRealmSlug,
      resolvedName
    )

    return {
      status: 'resolved',
      character: {
        source: identity.source,
        site: identity.site,
        id: character.canonicalID ?? character.id ?? null,
        name: resolvedName,
        normalizedName: asNormalizedName(resolvedName),
        region: resolvedRegion,
        realmSlug: resolvedRealmSlug,
        realmName: resolvedRealmName,
        canonicalUrl,
        className: null,
        specName: null,
        faction: character.faction?.name ?? null,
        level: character.level ?? null,
        warnings: [...warnings],
      },
      warnings,
    }
  } catch (error) {
    const classified = classifyLookupFailure(error)
    return {
      status: classified.code === 'UNSUPPORTED_QUERY_SCHEMA' ? 'unsupported' : 'error',
      character: null,
      warnings,
      error: classified,
    }
  }
}
