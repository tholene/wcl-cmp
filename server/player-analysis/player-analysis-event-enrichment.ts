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
  abilityName: string
  abilityType: number | string

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
  totalRows: number
  rowsWithAbilityGameId: number
  rowsWithAbilityName: number
  rowsWithSourceName: number
  rowsWithTargetName: number
  abilityGameIdPct: number
  abilityNamePct: number
  sourceNamePct: number
  targetNamePct: number
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
// Ability resolution — WCL uses multiple casing conventions depending on
// event type and API version. Check all known variants in priority order.
// ---------------------------------------------------------------------------

export function resolveAbilityGameId(event: RawEvent): number | undefined {
  if (typeof event.ability?.gameID === 'number') return event.ability.gameID
  if (typeof event.ability?.guid === 'number') return event.ability.guid
  if (typeof event.ability?.id === 'number') return event.ability.id
  if (typeof event.abilityGameID === 'number') return event.abilityGameID
  if (typeof event.abilityGameId === 'number') return event.abilityGameId
  if (typeof event.abilityID === 'number') return event.abilityID
  if (typeof event.abilityId === 'number') return event.abilityId
  return undefined
}

export function resolveAbilityName(event: RawEvent): string | undefined {
  if (typeof event.ability?.name === 'string') return event.ability.name
  if (typeof event.abilityName === 'string') return event.abilityName
  return undefined
}

export function resolveAbilityType(event: RawEvent): number | string | undefined {
  const t = event.ability?.type
  if (t !== null && t !== undefined) return t as number | string
  return undefined
}

// ---------------------------------------------------------------------------
// Main enrichment function
// ---------------------------------------------------------------------------

export function enrichWclEvent(event: RawEvent, fightStartTime: number, actorMap: ActorMap): EnrichedEvent {
  const ts = typeof event.timestamp === 'number' ? event.timestamp : fightStartTime
  const relTs = Math.max(0, Math.floor(ts - fightStartTime))

  const srcId = typeof event.sourceID === 'number' ? event.sourceID : undefined
  const tgtId = typeof event.targetID === 'number' ? event.targetID : undefined

  const srcActor = srcId !== undefined ? actorMap.get(srcId) : undefined
  const tgtActor = tgtId !== undefined ? actorMap.get(tgtId) : undefined

  const abilityGameId = resolveAbilityGameId(event)
  const abilityName = resolveAbilityName(event) ?? ''
  const abilityType = resolveAbilityType(event)

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
    abilityName,
    abilityType: abilityType ?? '',

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
    view, totalRows: 0,
    rowsWithAbilityGameId: 0, rowsWithAbilityName: 0, rowsWithSourceName: 0, rowsWithTargetName: 0,
    abilityGameIdPct: 0, abilityNamePct: 0, sourceNamePct: 0, targetNamePct: 0,
  }
  if (total === 0) return empty

  const nonBlank = (v: unknown) => v !== '' && v !== null && v !== undefined

  const withAbilityGameId = rows.filter((r) => nonBlank(r['abilityGameId'])).length
  const withAbilityName = rows.filter((r) => nonBlank(r['abilityName'])).length
  const withSourceName = rows.filter((r) => nonBlank(r['sourceName'])).length
  const withTargetName = rows.filter((r) => nonBlank(r['targetName'])).length

  const pct = (n: number) => Math.round((n / total) * 100)

  return {
    view, totalRows: total,
    rowsWithAbilityGameId: withAbilityGameId, rowsWithAbilityName: withAbilityName,
    rowsWithSourceName: withSourceName, rowsWithTargetName: withTargetName,
    abilityGameIdPct: pct(withAbilityGameId), abilityNamePct: pct(withAbilityName),
    sourceNamePct: pct(withSourceName), targetNamePct: pct(withTargetName),
  }
}
