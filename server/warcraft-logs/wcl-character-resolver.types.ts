import type { WclSite } from './wcl-site'

export type WclCharacterResolveRequest = {
  wclSite?: WclSite | string
  characterUrl?: string
  region?: string
  realmSlug?: string
  characterName?: string
}

export type WclCharacterResolveStatus = 'resolved' | 'not_found' | 'unsupported' | 'error'

export type WclCharacterResolveErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED_QUERY_SCHEMA'
  | 'AUTH_OR_SITE_FAILURE'
  | 'UNKNOWN_LOOKUP_FAILURE'

export type ResolvedWclCharacter = {
  source: 'url' | 'exactLookup'
  site: WclSite
  id?: number | null
  name: string
  normalizedName: string
  region?: string | null
  realmSlug?: string | null
  realmName?: string | null
  canonicalUrl?: string | null
  className?: string | null
  specName?: string | null
  faction?: string | null
  level?: number | null
  warnings: string[]
}

export type WclCharacterResolveError = {
  code: WclCharacterResolveErrorCode
  message: string
  hint?: string
}

export type WclCharacterResolveResult = {
  status: WclCharacterResolveStatus
  character: ResolvedWclCharacter | null
  warnings: string[]
  error?: WclCharacterResolveError
}
