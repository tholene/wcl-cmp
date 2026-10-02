import type { WclConfig } from '../warcraft-logs/wcl-config'
import type { WclSite } from '../warcraft-logs/wcl-site'
import { queryWclGraphQl } from '../warcraft-logs/wcl-client'

export type RawWclEvent = {
  timestamp?: number
  type?: string
  sourceID?: number
  targetID?: number
  abilityGameID?: number
  ability?: { id?: number; guid?: number; gameID?: number; name?: string } | null
  amount?: number
  absorbed?: number
  overkill?: number
  [key: string]: unknown
}

type ReportEventsResponse = {
  reportData: {
    report: {
      events: { data: RawWclEvent[] | null; nextPageTimestamp: number | null } | null
    } | null
  }
}

const REPORT_EVENTS_QUERY = `
  query MechanicAuditEvents(
    $code: String!
    $fightIDs: [Int]!
    $dataType: EventDataType!
    $filterExpression: String
    $startTime: Float!
    $endTime: Float!
    $limit: Int
  ) {
    reportData {
      report(code: $code) {
        events(
          fightIDs: $fightIDs
          dataType: $dataType
          filterExpression: $filterExpression
          startTime: $startTime
          endTime: $endTime
          limit: $limit
          translate: true
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`

export type MechanicAuditEventLimits = {
  maxEventsPerReport: number
  maxPagesPerReport: number
}

export const MECHANIC_AUDIT_DEFAULT_EVENT_LIMITS: MechanicAuditEventLimits = {
  maxEventsPerReport: 50_000,
  maxPagesPerReport: 100,
}

const buildAbilityFilterExpression = (abilityIds: number[]): string | undefined => {
  if (abilityIds.length === 0) return undefined
  return `ability.id in (${abilityIds.join(', ')})`
}

export type FetchReportEventsResult = {
  events: RawWclEvent[]
  truncated: boolean
  warnings: string[]
}

/**
 * Report-level, batched event fetch: one query per (report, dataType) covering every
 * selected fight and every relevant ability ID at once, rather than looping per player
 * or per fight like the Player Analysis fetcher does.
 */
export const fetchReportEventsForFights = async (params: {
  config: WclConfig
  site?: WclSite
  reportCode: string
  fightIds: number[]
  abilityIds: number[]
  dataType: 'DamageTaken' | 'Deaths' | 'Casts' | 'Debuffs' | 'Buffs'
  /** Report-relative ms (same scale as fight.startTime), NOT report.startTime's absolute epoch — verified live. */
  reportStartTime: number
  /** Report-relative ms (same scale as fight.endTime). */
  reportEndTime: number
  limits?: MechanicAuditEventLimits
}): Promise<FetchReportEventsResult> => {
  const limits = params.limits ?? MECHANIC_AUDIT_DEFAULT_EVENT_LIMITS
  const events: RawWclEvent[] = []
  const warnings: string[] = []
  let truncated = false

  if (params.fightIds.length === 0) {
    return { events, truncated, warnings }
  }

  let currentStart = params.reportStartTime
  let pageCount = 0

  try {
    while (true) {
      pageCount += 1
      if (pageCount > limits.maxPagesPerReport) {
        truncated = true
        warnings.push(
          `Truncated ${params.dataType} events for report ${params.reportCode}: exceeded ${limits.maxPagesPerReport} pages.`
        )
        break
      }

      const response = await queryWclGraphQl<ReportEventsResponse>({
        config: params.config,
        site: params.site,
        query: REPORT_EVENTS_QUERY,
        variables: {
          code: params.reportCode,
          fightIDs: params.fightIds,
          dataType: params.dataType,
          filterExpression: buildAbilityFilterExpression(params.abilityIds),
          startTime: currentStart,
          endTime: params.reportEndTime,
          limit: 10_000,
        },
      })

      const page = response.reportData?.report?.events
      if (!page) break

      const pageEvents = page.data ?? []
      events.push(...pageEvents)

      if (events.length >= limits.maxEventsPerReport) {
        truncated = true
        events.length = limits.maxEventsPerReport
        warnings.push(
          `Truncated ${params.dataType} events for report ${params.reportCode}: exceeded ${limits.maxEventsPerReport} events.`
        )
        break
      }

      const next = page.nextPageTimestamp ?? null
      if (next === null) break
      if (next <= currentStart) {
        // Guard against a non-advancing pagination cursor (would otherwise infinite-loop).
        truncated = true
        warnings.push(
          `Stopped paginating ${params.dataType} events for report ${params.reportCode}: nextPageTimestamp did not advance.`
        )
        break
      }
      currentStart = next
    }
  } catch (error) {
    warnings.push(
      `Failed to fetch ${params.dataType} events for report ${params.reportCode}: ${error instanceof Error ? error.message : 'unknown error'}`
    )
  }

  return { events, truncated, warnings }
}

export const resolveEventAbilityId = (event: RawWclEvent): number | undefined => {
  const nested = event.ability
  if (nested) {
    if (typeof nested.id === 'number') return nested.id
    if (typeof nested.gameID === 'number') return nested.gameID
    if (typeof nested.guid === 'number') return nested.guid
  }
  if (typeof event.abilityGameID === 'number') return event.abilityGameID
  return undefined
}

export const resolveEventAbilityName = (event: RawWclEvent): string | undefined => {
  const nested = event.ability
  if (nested?.name) return nested.name
  const flat = event.abilityName
  return typeof flat === 'string' ? flat : undefined
}
