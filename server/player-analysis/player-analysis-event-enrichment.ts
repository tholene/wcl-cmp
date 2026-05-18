import type { RawEvent } from './player-analysis-event-fetchers'

// ---------------------------------------------------------------------------
// Actor types
// ---------------------------------------------------------------------------

export type ActorInfo = {
  id: number
  name?: string
  type?: string
  subType?: string
  icon?: string
  ownerId?: number
  ownerName?: string
}

export type ActorMap = Map<number, ActorInfo>

export type AbilityInfo = {
  id?: number
  gameId?: number
  name?: string
  type?: number | string
  icon?: string
}

export type AbilityMaps = {
  byGameId: Map<number, AbilityInfo>
  byAbilityId: Map<number, AbilityInfo>
}

// ---------------------------------------------------------------------------
// Enriched event output type
// ---------------------------------------------------------------------------

export type EnrichedEvent = {
  eventType: string
  timestampMs: number
  relativeTimestampMs: number

  sourceId: number | string
  sourceName: string
  sourceType: string
  sourceSubType: string
  sourceOwnerId: string
  sourceOwnerName: string

  targetId: number | string
  targetName: string
  targetType: string
  targetSubType: string
  targetOwnerId: string
  targetOwnerName: string

  abilityGameId: number | string
  abilityId: number | string
  abilityName: string
  abilityType: number | string
  rawAbilityGameId: number | string
  rawAbilityId: number | string
  rawAbilityName: string
  abilityResolutionSource: 'event' | 'masterData' | 'unresolved'

  amount: number | string
  overheal: number | string
  absorbed: number | string
  mitigated: number | string
  blocked: number | string
  resisted: number | string
  overkill: number | string
  critical: string
  hitType: number | string
  stack: number | string

  rawEventJson: string
}

// ---------------------------------------------------------------------------
// Data quality stats
// ---------------------------------------------------------------------------

export type DataQualityStats = {
  view: string
  rowCount: number
  totalRows: number
  rowsWithAbilityGameId: number
  rowsWithAbilityName: number
  rowsWithSourceName: number
  rowsWithTargetName: number
  rowsWithAbilityNameFromEvent: number
  rowsWithAbilityNameFromMasterData: number
  abilityGameIdPct: number
  abilityNamePct: number
  sourceNamePct: number
  targetNamePct: number
  rawEventJsonIncluded: 'yes' | 'no'
  lowAbilityNameReason?: string
}

// ---------------------------------------------------------------------------
// Build actor map from WCL masterData actors list
// ---------------------------------------------------------------------------

export function buildActorMapFromList(
  actors: Array<{
    id: number
    name?: string | null
    type?: string | null
    subType?: string | null
    icon?: string | null
    petOwner?: number | null
  }>
): ActorMap {
  const map: ActorMap = new Map()

  // First pass: basic entries
  for (const a of actors) {
    if (a.id > 0) {
      map.set(a.id, {
        id: a.id,
        name: a.name ?? undefined,
        type: a.type ?? undefined,
        subType: a.subType ?? undefined,
        icon: a.icon ?? undefined,
        ownerId: typeof a.petOwner === 'number' ? a.petOwner : undefined,
      })
    }
  }

  // Second pass: resolve owner names
  for (const actor of map.values()) {
    if (actor.ownerId !== undefined) {
      actor.ownerName = map.get(actor.ownerId)?.name
    }
  }

  return map
}

// ---------------------------------------------------------------------------
// Build ability maps from WCL masterData.abilities.
// WCL shape can vary across endpoints and payload versions.
// ---------------------------------------------------------------------------

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function buildAbilityMapsFromList(abilities: Array<Record<string, unknown>>): AbilityMaps {
  const byGameId: Map<number, AbilityInfo> = new Map()
  const byAbilityId: Map<number, AbilityInfo> = new Map()

  for (const ability of abilities) {
    // Ability identifiers can be exposed as gameID/gameId/guid and id.
    const gameId =
      asNumber(ability.gameID) ??
      asNumber(ability.gameId) ??
      asNumber(ability.guid)
    const id = asNumber(ability.id)
    const name = asString(ability.name)
    const icon = asString(ability.icon) ?? asString(ability.abilityIcon)

    const typeValue = ability.type
    const type =
      typeof typeValue === 'number' || typeof typeValue === 'string'
        ? typeValue
        : undefined

    const info: AbilityInfo = { id, gameId, name, type, icon }

    if (typeof gameId === 'number' && gameId > 0) {
      byGameId.set(gameId, info)
    }
    if (typeof id === 'number' && id > 0) {
      byAbilityId.set(id, info)
    }
  }

  return { byGameId, byAbilityId }
}

function resolveRawAbilityGameId(event: RawEvent): number | undefined {
  const nested = event.ability as Record<string, unknown> | null | undefined
  if (nested) {
    const nestedGameId =
      asNumber(nested.gameID) ??
      asNumber(nested.gameId) ??
      asNumber(nested.guid)
    if (nestedGameId !== undefined) return nestedGameId
  }

  if (typeof event.abilityGameID === 'number') return event.abilityGameID
  if (typeof event.abilityGameId === 'number') return event.abilityGameId
  return undefined
}

function resolveRawAbilityId(event: RawEvent): number | undefined {
  const nested = event.ability as Record<string, unknown> | null | undefined
  if (nested) {
    const nestedId = asNumber(nested.id)
    if (nestedId !== undefined) return nestedId
  }

  if (typeof event.abilityID === 'number') return event.abilityID
  if (typeof event.abilityId === 'number') return event.abilityId
  return undefined
}

function resolveRawAbilityName(event: RawEvent): string | undefined {
  const nested = event.ability as Record<string, unknown> | null | undefined
  if (nested) {
    const nestedName = asString(nested.name)
    if (nestedName) return nestedName
  }
  if (typeof event.abilityName === 'string') return event.abilityName
  return undefined
}

function resolveRawAbilityType(event: RawEvent): number | string | undefined {
  const nested = event.ability as Record<string, unknown> | null | undefined
  if (nested) {
    const nestedType = nested.type
    if (typeof nestedType === 'number' || typeof nestedType === 'string') return nestedType
  }
  const flatType = (event as Record<string, unknown>).abilityType
  if (typeof flatType === 'number' || typeof flatType === 'string') return flatType
  return undefined
}

// ---------------------------------------------------------------------------
// Main enrichment function
// ---------------------------------------------------------------------------

export function enrichWclEvent(
  event: RawEvent,
  fightStartTime: number,
  actorMap: ActorMap,
  abilityMaps: AbilityMaps
): EnrichedEvent {
  const ts = typeof event.timestamp === 'number' ? event.timestamp : fightStartTime
  const relTs = Math.max(0, Math.floor(ts - fightStartTime))

  const srcId = typeof event.sourceID === 'number' ? event.sourceID : undefined
  const tgtId = typeof event.targetID === 'number' ? event.targetID : undefined

  const srcActor = srcId !== undefined ? actorMap.get(srcId) : undefined
  const tgtActor = tgtId !== undefined ? actorMap.get(tgtId) : undefined

  // Resolution order:
  // 1) event nested ability object
  // 2) event flat ability fields
  // 3) report masterData.abilities map by gameID/id
  const rawAbilityGameId = resolveRawAbilityGameId(event)
  const rawAbilityId = resolveRawAbilityId(event)
  const rawAbilityName = resolveRawAbilityName(event)
  const rawAbilityType = resolveRawAbilityType(event)

  const mappedAbility =
    (rawAbilityGameId !== undefined ? abilityMaps.byGameId.get(rawAbilityGameId) : undefined) ??
    (rawAbilityId !== undefined ? abilityMaps.byAbilityId.get(rawAbilityId) : undefined)

  const abilityGameId = rawAbilityGameId ?? mappedAbility?.gameId
  const abilityId = rawAbilityId ?? mappedAbility?.id
  const abilityName = rawAbilityName ?? mappedAbility?.name ?? ''
  const abilityType = rawAbilityType ?? mappedAbility?.type
  const abilityResolutionSource: EnrichedEvent['abilityResolutionSource'] =
    rawAbilityName ? 'event' : abilityName ? 'masterData' : 'unresolved'

  // hitType 2 = critical hit in WCL combat log conventions
  const hitType = typeof event.hitType === 'number' ? event.hitType : ''
  const critical =
    event.hitType === 2 ? 'true' : event.hitType !== undefined && event.hitType !== null ? 'false' : ''

  return {
    eventType: event.type ?? '',
    timestampMs: ts,
    relativeTimestampMs: relTs,

    sourceId: srcId ?? '',
    sourceName: srcActor?.name ?? '',
    sourceType: srcActor?.type ?? '',
    sourceSubType: srcActor?.subType ?? '',
    sourceOwnerId: srcActor?.ownerId !== undefined ? String(srcActor.ownerId) : '',
    sourceOwnerName: srcActor?.ownerName ?? '',

    targetId: tgtId ?? '',
    targetName: tgtActor?.name ?? '',
    targetType: tgtActor?.type ?? '',
    targetSubType: tgtActor?.subType ?? '',
    targetOwnerId: tgtActor?.ownerId !== undefined ? String(tgtActor.ownerId) : '',
    targetOwnerName: tgtActor?.ownerName ?? '',

    abilityGameId: abilityGameId ?? '',
    abilityId: abilityId ?? '',
    abilityName,
    abilityType: abilityType ?? '',
    rawAbilityGameId: rawAbilityGameId ?? '',
    rawAbilityId: rawAbilityId ?? '',
    rawAbilityName: rawAbilityName ?? '',
    abilityResolutionSource,

    amount: event.amount ?? '',
    overheal: event.overheal ?? '',
    absorbed: event.absorbed ?? '',
    mitigated: event.mitigated ?? '',
    blocked: event.blocked ?? '',
    resisted: event.resisted ?? '',
    overkill: event.overkill ?? '',
    critical,
    hitType,
    stack: event.stack ?? '',

    rawEventJson: JSON.stringify(event),
  }
}

// ---------------------------------------------------------------------------
// Data quality
// ---------------------------------------------------------------------------

export function computeDataQuality(view: string, rows: Array<Record<string, unknown>>): DataQualityStats {
  const total = rows.length
  const empty: DataQualityStats = {
    view, rowCount: 0, totalRows: 0,
    rowsWithAbilityGameId: 0, rowsWithAbilityName: 0, rowsWithSourceName: 0, rowsWithTargetName: 0,
    rowsWithAbilityNameFromEvent: 0, rowsWithAbilityNameFromMasterData: 0,
    abilityGameIdPct: 0, abilityNamePct: 0, sourceNamePct: 0, targetNamePct: 0,
    rawEventJsonIncluded: 'no',
  }
  if (total === 0) return empty

  const nonBlank = (v: unknown) => v !== '' && v !== null && v !== undefined

  const withAbilityGameId = rows.filter((r) => nonBlank(r['abilityGameId'])).length
  const withAbilityName = rows.filter((r) => nonBlank(r['abilityName'])).length
  const withSourceName = rows.filter((r) => nonBlank(r['sourceName'])).length
  const withTargetName = rows.filter((r) => nonBlank(r['targetName'])).length
  const withAbilityNameFromEvent = rows.filter((r) => r['abilityResolutionSource'] === 'event').length
  const withAbilityNameFromMasterData = rows.filter((r) => r['abilityResolutionSource'] === 'masterData').length
  const withRawEventJson = rows.filter((r) => nonBlank(r['rawEventJson'])).length

  const pct = (n: number) => Math.round((n / total) * 100)

  let lowAbilityNameReason: string | undefined
  if (withAbilityName < total / 2) {
    if (withAbilityGameId === 0) {
      lowAbilityNameReason = 'event payloads lacked recognizable ability identifiers for most rows'
    } else if (withAbilityNameFromMasterData === 0 && withAbilityNameFromEvent > 0) {
      lowAbilityNameReason = 'some rows had event ability names, but remaining ability IDs did not match report masterData abilities'
    } else if (withAbilityNameFromMasterData > 0) {
      lowAbilityNameReason = 'masterData abilities recovered some names, but many rows still had no event or mapped ability name'
    } else {
      lowAbilityNameReason = 'ability IDs existed, but neither event fields nor report masterData abilities provided names'
    }
  }

  return {
    view, rowCount: total, totalRows: total,
    rowsWithAbilityGameId: withAbilityGameId, rowsWithAbilityName: withAbilityName,
    rowsWithSourceName: withSourceName, rowsWithTargetName: withTargetName,
    rowsWithAbilityNameFromEvent: withAbilityNameFromEvent,
    rowsWithAbilityNameFromMasterData: withAbilityNameFromMasterData,
    abilityGameIdPct: pct(withAbilityGameId), abilityNamePct: pct(withAbilityName),
    sourceNamePct: pct(withSourceName), targetNamePct: pct(withTargetName),
    rawEventJsonIncluded: withRawEventJson === total ? 'yes' : 'no',
    lowAbilityNameReason,
  }
}
