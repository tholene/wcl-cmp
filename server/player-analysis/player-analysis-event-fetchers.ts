import { queryWclGraphQl } from '../warcraft-logs/wcl-client'
import type { WclConfig } from '../warcraft-logs/wcl-config'

export type RawEvent = {
  timestamp?: number | null
  type?: string | null
  sourceID?: number | null
  targetID?: number | null
  amount?: number | null
  absorbed?: number | null
  overkill?: number | null
  overheal?: number | null
  ability?: { gameID?: number | null; name?: string | null } | null
  // CombatantInfo fields
  specID?: number | null
  strength?: number | null
  agility?: number | null
  intellect?: number | null
  auras?: unknown[] | null
  gear?: unknown[] | null
  talentTree?: unknown[] | null
  [key: string]: unknown
}

export type EventFetchResult = {
  events: RawEvent[]
  truncated: boolean
  warnings: string[]
}

type FetchParams = {
  config: WclConfig
  code: string
  fightId: number
  startTime: number
  endTime: number
  sourceId?: number
  targetId?: number
  maxEvents: number
}

type EventsQueryResponse = {
  reportData?: {
    report?: {
      events?: {
        data?: RawEvent[]
        nextPageTimestamp?: number | null
      } | null
    } | null
  }
}

const buildEventsQuery = (dataType: string): string => `
  query FetchEvents_${dataType}(
    $code: String!
    $startTime: Float!
    $endTime: Float!
    $fightId: Int!
    $sourceId: Int
    $targetId: Int
  ) {
    reportData {
      report(code: $code) {
        events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: ${dataType}
          sourceID: $sourceId
          targetID: $targetId
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`

const DAMAGE_DONE_QUERY = buildEventsQuery('DamageDone')
const DAMAGE_TAKEN_QUERY = buildEventsQuery('DamageTaken')
const CASTS_QUERY = buildEventsQuery('Casts')
const BUFFS_QUERY = buildEventsQuery('Buffs')
const DEBUFFS_QUERY = buildEventsQuery('Debuffs')
const HEALING_QUERY = buildEventsQuery('Healing')
const DEATHS_QUERY = buildEventsQuery('Deaths')
const COMBATANT_INFO_QUERY = buildEventsQuery('CombatantInfo')
const INTERRUPTS_QUERY = buildEventsQuery('Interrupts')
const DISPELS_QUERY = buildEventsQuery('Dispels')
const RESOURCES_QUERY = buildEventsQuery('Resources')

async function fetchPaginatedEvents(params: FetchParams & { query: string; label: string }): Promise<EventFetchResult> {
  const { config, code, fightId, startTime, endTime, sourceId, targetId, maxEvents, query, label } = params
  const events: RawEvent[] = []
  const warnings: string[] = []
  let currentStart = startTime
  let truncated = false

  try {
    while (true) {
      const response = await queryWclGraphQl<EventsQueryResponse>({
        config,
        query,
        variables: { code, startTime: currentStart, endTime, fightId, sourceId, targetId },
      })

      const page = response.reportData?.report?.events
      const pageData = page?.data ?? []
      events.push(...pageData)

      if (events.length >= maxEvents) {
        truncated = true
        warnings.push(`Events for ${label} truncated at ${maxEvents} rows (limit reached)`)
        break
      }

      const next = page?.nextPageTimestamp ?? null
      if (!next) break
      currentStart = next
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warnings.push(`${label} not available from WCL: ${message}`)
    return { events: [], truncated: false, warnings }
  }

  return { events: events.slice(0, maxEvents), truncated, warnings }
}

export async function fetchDamageDoneEvents(params: FetchParams): Promise<EventFetchResult> {
  return fetchPaginatedEvents({ ...params, query: DAMAGE_DONE_QUERY, label: 'Damage done', targetId: undefined })
}

export async function fetchDamageTakenEvents(params: FetchParams): Promise<EventFetchResult> {
  return fetchPaginatedEvents({ ...params, query: DAMAGE_TAKEN_QUERY, label: 'Damage taken', sourceId: undefined })
}

export async function fetchCastEvents(params: FetchParams): Promise<EventFetchResult> {
  return fetchPaginatedEvents({ ...params, query: CASTS_QUERY, label: 'Casts', targetId: undefined })
}

export async function fetchBuffEvents(params: FetchParams): Promise<EventFetchResult> {
  return fetchPaginatedEvents({ ...params, query: BUFFS_QUERY, label: 'Buffs', targetId: undefined })
}

export async function fetchDebuffEvents(params: FetchParams): Promise<EventFetchResult> {
  return fetchPaginatedEvents({ ...params, query: DEBUFFS_QUERY, label: 'Debuffs', targetId: undefined })
}

export async function fetchHealingEvents(params: FetchParams): Promise<EventFetchResult> {
  return fetchPaginatedEvents({ ...params, query: HEALING_QUERY, label: 'Healing', targetId: undefined })
}

export async function fetchDeathEvents(params: FetchParams): Promise<EventFetchResult> {
  // Deaths are not source/target-filtered on WCL side; filter client-side by targetId
  return fetchPaginatedEvents({ ...params, query: DEATHS_QUERY, label: 'Deaths', sourceId: undefined, targetId: undefined })
}

export async function fetchCombatantInfoEvents(params: FetchParams): Promise<EventFetchResult> {
  // CombatantInfo: one event per player at fight start, no pagination needed
  try {
    const response = await queryWclGraphQl<EventsQueryResponse>({
      config: params.config,
      query: COMBATANT_INFO_QUERY,
      variables: {
        code: params.code,
        startTime: params.startTime,
        endTime: params.endTime,
        fightId: params.fightId,
        sourceId: undefined,
        targetId: undefined,
      },
    })
    const events = (response.reportData?.report?.events?.data ?? []) as RawEvent[]
    return { events, truncated: false, warnings: [] }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { events: [], truncated: false, warnings: [`CombatantInfo not available: ${message}`] }
  }
}

export async function fetchInterruptEvents(params: FetchParams): Promise<EventFetchResult> {
  return fetchPaginatedEvents({ ...params, query: INTERRUPTS_QUERY, label: 'Interrupts', targetId: undefined })
}

export async function fetchDispelEvents(params: FetchParams): Promise<EventFetchResult> {
  return fetchPaginatedEvents({ ...params, query: DISPELS_QUERY, label: 'Dispels', targetId: undefined })
}

export async function fetchResourceEvents(params: FetchParams): Promise<EventFetchResult> {
  return fetchPaginatedEvents({ ...params, query: RESOURCES_QUERY, label: 'Resources', targetId: undefined })
}
