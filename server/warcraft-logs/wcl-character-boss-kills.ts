import { classifyWclError } from './wcl-error-hints'
import { queryWclGraphQl } from './wcl-client'
import type { WclConfig } from './wcl-config'
import {
  resolveWclCharacter,
  validateWclCharacterResolveRequest,
} from './wcl-character-resolver'
import type {
  WclCharacterBossKill,
  WclCharacterBossKillsRequest,
  WclCharacterBossKillsResult,
} from './wcl-character-boss-kills.types'
import type { WclCharacterResolveResult } from './wcl-character-resolver.types'
import { classifyRaidZone } from './raid-zone-classifier'
import type { WclSite } from './wcl-site'

type WclCharacterReportsQueryResponse = {
  characterData?: {
    character?: {
      id?: number | null
      name?: string | null
      recentReports?: {
        data?: Array<{
          code: string
          title?: string | null
          startTime?: number | null
          zone?: {
            id?: number | null
            name?: string | null
          } | null
          fights?: Array<{
            id: number
            encounterID: number
            name?: string | null
            kill: boolean
            difficulty?: number | null
            startTime?: number | null
            endTime?: number | null
          }>
        }>
      } | null
    } | null
  }
}

type WclFightRankingsQueryResponse = {
  reportData?: {
    report?: {
      rankings?: unknown
    } | null
  }
}

type RankingCharacter = {
  id?: number
  name?: string
  class?: string
  spec?: string
  bracketData?: number
  rankPercent?: number
  bracketPercent?: number
}

type RankingLookup = {
  byCharacterId: Map<number, RankingCharacter>
  byNormalizedName: Map<string, RankingCharacter>
}

type ValidationResult =
  | {
      ok: true
      normalized: {
        includeWipes: boolean
        limit: number
      }
    }
  | {
      ok: false
      message: string
    }

type BossKillServiceDeps = {
  resolver?: (config: WclConfig, request: WclCharacterBossKillsRequest) => Promise<WclCharacterResolveResult>
  query?: typeof queryWclGraphQl
}

const RECENT_REPORTS_QUERY = `
  query CharacterRecentReports($name: String!, $serverSlug: String!, $serverRegion: String!, $limit: Int!) {
    characterData {
      character(name: $name, serverSlug: $serverSlug, serverRegion: $serverRegion) {
        id
        name
        recentReports(limit: $limit, page: 1) {
          data {
            code
            title
            startTime
            zone {
              id
              name
            }
            fights {
              id
              encounterID
              name
              kill
              difficulty
              startTime
              endTime
            }
          }
        }
      }
    }
  }
`

const FIGHT_RANKINGS_QUERY = `
  query FightRankings($code: String!, $fightId: Int!) {
    reportData {
      report(code: $code) {
        rankings(fightIDs: [$fightId])
      }
    }
  }
`

const DEFAULT_LIMIT = 10
const MAX_LIMIT = 30
const MAX_RECENT_REPORTS = 12
const MAX_RANKING_LOOKUPS = 12

const normalizeText = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const normalizeName = (value: string): string => value.trim().toLowerCase()

const normalizeRegionForLookup = (value: string): string => value.trim().toUpperCase()

const safeNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const computeFightStartTime = (reportStart: number | null, fightStart: number | null): number | null => {
  if (reportStart === null || fightStart === null) return null
  return reportStart + fightStart
}

const computeFightDurationMs = (fightStart: number | null, fightEnd: number | null): number | null => {
  if (fightStart === null || fightEnd === null) return null
  const duration = fightEnd - fightStart
  return duration >= 0 ? duration : null
}

const formatZoneSummary = (zoneId: number | null, zoneName: string | null | undefined, reportCode: string): string => {
  const zone = normalizeText(zoneName) ?? 'Unknown zone'
  const id = zoneId ?? 'n/a'
  return `${zone} (id ${id}) report ${reportCode}`
}

const dedupeKey = (entry: { reportCode: string; fightId: number }): string => `${entry.reportCode}:${entry.fightId}`

export const dedupeBossKills = (kills: WclCharacterBossKill[]): WclCharacterBossKill[] => {
  const seen = new Set<string>()
  const deduped: WclCharacterBossKill[] = []

  for (const kill of kills) {
    const key = dedupeKey(kill)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(kill)
  }

  return deduped
}

const validateBossKillsRequest = (
  request: WclCharacterBossKillsRequest
): ValidationResult => {
  if (request.includeWipes !== undefined && typeof request.includeWipes !== 'boolean') {
    return {
      ok: false,
      message: 'includeWipes must be a boolean when provided.',
    }
  }

  if (request.limit !== undefined) {
    if (!Number.isInteger(request.limit) || request.limit <= 0) {
      return {
        ok: false,
        message: 'limit must be a positive integer when provided.',
      }
    }
  }

  const limit = Math.min(Math.max(request.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT)

  return {
    ok: true,
    normalized: {
      includeWipes: request.includeWipes ?? false,
      limit,
    },
  }
}

const mapResolveFailure = (resolveResult: WclCharacterResolveResult): WclCharacterBossKillsResult => {
  if (resolveResult.status === 'not_found') {
    return {
      status: 'not_found',
      character: null,
      bossKills: [],
      warnings: resolveResult.warnings,
    }
  }

  if (resolveResult.status === 'unsupported') {
    return {
      status: 'unsupported',
      character: null,
      bossKills: [],
      warnings: resolveResult.warnings,
      ...(resolveResult.error ? { error: resolveResult.error } : {}),
    }
  }

  return {
    status: 'error',
    character: null,
    bossKills: [],
    warnings: resolveResult.warnings,
    ...(resolveResult.error ? { error: resolveResult.error } : {}),
  }
}

const parseRankingsPayload = (raw: unknown): RankingLookup | null => {
  let parsed: unknown = raw

  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
  }

  if (!parsed || typeof parsed !== 'object') return null

  const firstFight = Array.isArray((parsed as { data?: unknown[] }).data)
    ? (parsed as { data: unknown[] }).data[0]
    : null
  if (!firstFight || typeof firstFight !== 'object') return null

  const roles = (firstFight as { roles?: unknown }).roles
  if (!roles || typeof roles !== 'object') return null

  const byCharacterId = new Map<number, RankingCharacter>()
  const byNormalizedName = new Map<string, RankingCharacter>()

  for (const roleKey of ['tanks', 'healers', 'dps']) {
    const role = (roles as Record<string, unknown>)[roleKey]
    if (!role || typeof role !== 'object') continue

    const characters = (role as { characters?: unknown }).characters
    if (!Array.isArray(characters)) continue

    for (const candidate of characters) {
      if (!candidate || typeof candidate !== 'object') continue
      const entry = candidate as RankingCharacter

      if (typeof entry.id === 'number') {
        byCharacterId.set(entry.id, entry)
      }

      if (typeof entry.name === 'string' && entry.name.trim().length > 0) {
        byNormalizedName.set(normalizeName(entry.name), entry)
      }
    }
  }

  return {
    byCharacterId,
    byNormalizedName,
  }
}

const applyRankingEnrichment = (
  baseEntry: WclCharacterBossKill,
  ranking: RankingCharacter | undefined
): WclCharacterBossKill => {
  if (!ranking) {
    return baseEntry
  }

  return {
    ...baseEntry,
    playerItemLevel: safeNumber(ranking.bracketData),
    className: normalizeText(ranking.class) ?? null,
    specName: normalizeText(ranking.spec) ?? null,
    percentile: safeNumber(ranking.rankPercent) ?? safeNumber(ranking.bracketPercent),
    metric: null,
    source: 'reportVerification',
  }
}

export const discoverWclCharacterBossKills = async (
  config: WclConfig,
  request: WclCharacterBossKillsRequest,
  deps: BossKillServiceDeps = {}
): Promise<WclCharacterBossKillsResult> => {
  const identityValidation = validateWclCharacterResolveRequest(request)
  if (!identityValidation.ok) {
    return {
      status: 'error',
      character: null,
      bossKills: [],
      warnings: [],
      error: {
        code: 'VALIDATION_ERROR',
        message: identityValidation.error.message,
        ...(identityValidation.error.hint ? { hint: identityValidation.error.hint } : {}),
      },
    }
  }

  const requestValidation = validateBossKillsRequest(request)
  if (!requestValidation.ok) {
    return {
      status: 'error',
      character: null,
      bossKills: [],
      warnings: [],
      error: {
        code: 'VALIDATION_ERROR',
        message: requestValidation.message,
      },
    }
  }

  const resolver = deps.resolver ?? resolveWclCharacter
  const query = deps.query ?? queryWclGraphQl

  const resolveResult = await resolver(config, request)
  if (resolveResult.status !== 'resolved' || !resolveResult.character) {
    return mapResolveFailure(resolveResult)
  }

  const resolvedCharacter = resolveResult.character
  const warnings = [...resolveResult.warnings]
  const discoverySite = resolvedCharacter.site as WclSite

  const reportLimit = Math.min(
    Math.max(Math.ceil(requestValidation.normalized.limit / 2), 3),
    MAX_RECENT_REPORTS
  )

  try {
    const reportsResponse = await query<WclCharacterReportsQueryResponse>({
      config,
      site: discoverySite,
      query: RECENT_REPORTS_QUERY,
      variables: {
        name: resolvedCharacter.name,
        serverSlug: resolvedCharacter.realmSlug,
        serverRegion: normalizeRegionForLookup(resolvedCharacter.region ?? ''),
        limit: reportLimit,
      },
    })

    const reports = reportsResponse.characterData?.character?.recentReports?.data ?? []
    if (reports.length === 0) {
      return {
        status: 'unsupported',
        character: resolvedCharacter,
        bossKills: [],
        warnings,
        error: {
          code: 'WCL_CHARACTER_REPORTS_EMPTY',
          message: 'WCL returned no recent reports for the resolved character.',
          hint: 'Try a different character or verify report visibility on the selected WCL site.',
        },
      }
    }

    const discoveredFights: WclCharacterBossKill[] = []

    for (const report of reports) {
      const zoneId = safeNumber(report.zone?.id)
      const zoneName = report.zone?.name ?? null
      const raidClassification = classifyRaidZone({ zoneId, zoneName })

      if (!raidClassification.isRaid) {
        warnings.push(`Skipping non-raid report: ${formatZoneSummary(zoneId, zoneName, report.code)}`)
        continue
      }

      const reportStart = safeNumber(report.startTime)
      const fights = report.fights ?? []

      for (const fight of fights) {
        if (fight.encounterID <= 0) continue
        if (!requestValidation.normalized.includeWipes && !fight.kill) continue

        const fightStart = safeNumber(fight.startTime)
        const fightEnd = safeNumber(fight.endTime)

        discoveredFights.push({
          site: discoverySite,
          reportCode: report.code,
          reportTitle: report.title ?? null,
          fightId: fight.id,
          encounterId: fight.encounterID,
          encounterName: normalizeText(fight.name) ?? `Unknown encounter ${fight.encounterID}`,
          difficulty: safeNumber(fight.difficulty),
          kill: fight.kill,
          durationMs: computeFightDurationMs(fightStart, fightEnd),
          startTime: computeFightStartTime(reportStart, fightStart),
          playerItemLevel: null,
          className: null,
          specName: null,
          percentile: null,
          metric: null,
          source: 'characterReports',
          warnings: [],
        })
      }
    }

    const deduped = dedupeBossKills(discoveredFights)
      .sort((left, right) => (right.startTime ?? 0) - (left.startTime ?? 0))
      .slice(0, requestValidation.normalized.limit)

    if (deduped.length === 0) {
      return {
        status: 'ok',
        character: resolvedCharacter,
        bossKills: [],
        warnings,
      }
    }

    const enrichLimit = Math.min(deduped.length, MAX_RANKING_LOOKUPS)
    const enriched = [...deduped]

    await Promise.all(
      enriched.slice(0, enrichLimit).map(async (fight, index) => {
        try {
          const rankingsResponse = await query<WclFightRankingsQueryResponse>({
            config,
            site: discoverySite,
            query: FIGHT_RANKINGS_QUERY,
            variables: {
              code: fight.reportCode,
              fightId: fight.fightId,
            },
          })

          const rankingLookup = parseRankingsPayload(rankingsResponse.reportData?.report?.rankings)
          if (!rankingLookup) {
            enriched[index] = {
              ...fight,
              warnings: [...fight.warnings, 'Ranking payload missing or unparsable for this fight.'],
            }
            return
          }

          const byId =
            typeof resolvedCharacter.id === 'number'
              ? rankingLookup.byCharacterId.get(resolvedCharacter.id)
              : undefined
          const byName = rankingLookup.byNormalizedName.get(normalizeName(resolvedCharacter.name))
          const rankingMatch = byId ?? byName

          enriched[index] = applyRankingEnrichment(fight, rankingMatch)

          if (!rankingMatch) {
            enriched[index] = {
              ...enriched[index],
              warnings: [...enriched[index].warnings, 'No per-fight ranking row matched the resolved character.'],
            }
          }
        } catch {
          enriched[index] = {
            ...fight,
            warnings: [...fight.warnings, 'Ranking enrichment failed for this fight.'],
          }
        }
      })
    )

    return {
      status: 'ok',
      character: resolvedCharacter,
      bossKills: enriched,
      warnings,
    }
  } catch (error) {
    const classified = classifyWclError(error, { site: discoverySite })

    return {
      status: classified.code === 'WCL_QUERY_UNSUPPORTED' ? 'unsupported' : 'error',
      character: resolvedCharacter,
      bossKills: [],
      warnings,
      error: {
        code:
          classified.code === 'WCL_QUERY_UNSUPPORTED'
            ? 'WCL_CHARACTER_REPORTS_UNSUPPORTED'
            : (classified.code as 'AUTH_OR_SITE_FAILURE' | 'UNKNOWN_LOOKUP_FAILURE'),
        message: classified.message,
        ...(classified.hint ? { hint: classified.hint } : {}),
      },
    }
  }
}
