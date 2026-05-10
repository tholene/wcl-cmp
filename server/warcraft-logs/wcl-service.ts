import type { WclConfig } from './wcl-config'
import { queryWclGraphQl } from './wcl-client'
import type {
  WclBossFightListItem,
  WclBossSummary,
  WclFightDamageEvent,
  WclFightDeathSummary,
  WclFightParticipant,
  WclPlayerFightReview,
  WclPlayerReviewEvent,
  WclPlayerReviewFinding,
  WclFightReview,
  WclFightSummary,
  WclRecentBossFightsResponse,
  WclRecentBossesResponse,
  WclReportDetails,
  WclReportSummary,
} from './wcl-types'

type ReportsQueryResponse = {
  reportData?: {
    reports?: {
      data?: Array<{
        code: string
        title: string
        startTime: number
        endTime: number
        visibility?: string | null
        owner?: {
          name?: string | null
        } | null
        zone?: {
          name?: string | null
        } | null
      }>
    }
  }
}

type ReportDetailsQueryResponse = {
  reportData?: {
    report?: {
      code: string
      title: string
      startTime: number
      endTime: number
      visibility?: string | null
      owner?: {
        name?: string | null
      } | null
      zone?: {
        name?: string | null
      } | null
      fights?: Array<{
        id: number
        encounterID: number
        name?: string | null
        kill: boolean
        difficulty: number
        startTime: number
        endTime: number
      }>
    } | null
  }
}

type WclActor = {
  id: number
  name?: string | null
  type?: string | null
  subType?: string | null
  icon?: string | null
}

type WclAbility = {
  gameID?: number | null
  name?: string | null
}

type WclRawEvent = {
  timestamp?: number | null
  sourceID?: number | null
  targetID?: number | null
  amount?: number | null
  absorbed?: number | null
  overkill?: number | null
  ability?: WclAbility | null
}

type WclEventsResponse = {
  data?: WclRawEvent[]
  nextPageTimestamp?: number | null
}

type FightReviewQueryResponse = {
  reportData?: {
    report?: {
      code: string
      title: string
      startTime: number
      fights?: Array<{
        id: number
        encounterID: number
        name?: string | null
        kill: boolean
        difficulty: number
        startTime: number
        endTime: number
      }>
      masterData?: {
        actors?: WclActor[]
      } | null
      deaths?: WclEventsResponse | null
      damageTaken?: WclEventsResponse | null
    } | null
  }
}

type PlayerReviewQueryResponse = {
  reportData?: {
    report?: {
      code: string
      title: string
      startTime: number
      fights?: Array<{
        id: number
        encounterID: number
        name?: string | null
        kill: boolean
        difficulty: number
        startTime: number
        endTime: number
      }>
      masterData?: {
        actors?: WclActor[]
      } | null
      casts?: WclEventsResponse | null
      damageDone?: WclEventsResponse | null
      damageTaken?: WclEventsResponse | null
      deaths?: WclEventsResponse | null
      buffs?: WclEventsResponse | null
      interrupts?: WclEventsResponse | null
      dispels?: WclEventsResponse | null
    } | null
  }
}

type WclKnownServiceErrorCode = 'NOT_FOUND' | 'BAD_REQUEST' | 'UPSTREAM'

type WclServiceError = Error & {
  code: WclKnownServiceErrorCode
}

const createWclServiceError = (message: string, code: WclKnownServiceErrorCode): WclServiceError => {
  const error = new Error(message) as WclServiceError
  error.name = 'WclServiceError'
  error.code = code
  return error
}
type AggregatedFightContext = {
  reportCode: string
  reportTitle: string
  reportStartTime: number
  reportUrl: string
  fightId: number
  encounterId: number
  encounterName: string
  kill: boolean
  difficulty: number
  startTime: number
  endTime: number
  durationMs: number
}

type AggregatedBossSource = {
  reportCount: number
  note: string
}

const RECENT_REPORT_LIMIT = 15

const REPORTS_BY_GUILD_QUERY = `
  query ReportsByGuild($guildId: Int!, $limit: Int!) {
    reportData {
      reports(guildID: $guildId, limit: $limit) {
        data {
          code
          title
          startTime
          endTime
          visibility
          owner {
            name
          }
          zone {
            name
          }
        }
      }
    }
  }
`

const REPORT_DETAILS_QUERY = `
  query ReportDetails($code: String!) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        endTime
        visibility
        owner {
          name
        }
        zone {
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
`

const FIGHT_REVIEW_QUERY = `
  query FightReview(
    $code: String!
    $fightId: Int!
    $startTime: Float!
    $endTime: Float!
  ) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        fights(fightIDs: [$fightId]) {
          id
          encounterID
          name
          kill
          difficulty
          startTime
          endTime
        }
        masterData(translate: true) {
          actors {
            id
            name
            type
            subType
            icon
          }
        }
        deaths: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: Deaths
        ) {
          data
          nextPageTimestamp
        }
        damageTaken: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: DamageTaken
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`

const PLAYER_REVIEW_QUERY = `
  query PlayerFightReview(
    $code: String!
    $fightId: Int!
    $startTime: Float!
    $endTime: Float!
  ) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        fights(fightIDs: [$fightId]) {
          id
          encounterID
          name
          kill
          difficulty
          startTime
          endTime
        }
        masterData(translate: true) {
          actors {
            id
            name
            type
            subType
            icon
          }
        }
        casts: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: Casts
        ) {
          data
          nextPageTimestamp
        }
        damageDone: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: DamageDone
        ) {
          data
          nextPageTimestamp
        }
        damageTaken: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: DamageTaken
        ) {
          data
          nextPageTimestamp
        }
        deaths: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: Deaths
        ) {
          data
          nextPageTimestamp
        }
        buffs: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: Buffs
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`

const mapFights = (
  fights: Array<{
    id: number
    encounterID: number
    name?: string | null
    kill: boolean
    difficulty: number
    startTime: number
    endTime: number
  }> = []
): WclFightSummary[] =>
  fights
    .filter((fight) => fight.encounterID > 0)
    .map((fight) => ({
      id: fight.id,
      encounterId: fight.encounterID,
      encounterName: fight.name ?? `Unknown encounter ${fight.encounterID}`,
      kill: fight.kill,
      difficulty: fight.difficulty,
      startTime: fight.startTime,
      endTime: fight.endTime,
    }))

const buildAggregationNote = (params: { reportCount: number; failedReportCount: number }): string => {
  if (!params.reportCount) {
    return 'No recent reports were available for aggregation.'
  }

  if (!params.failedReportCount) {
    return `Grouped from the latest ${params.reportCount} reports.`
  }

  return `Grouped from ${params.reportCount - params.failedReportCount}/${params.reportCount} reports. ${params.failedReportCount} report fetches failed and were skipped.`
}

const DAMAGE_WINDOW_MS = 10_000
const OPENER_WINDOW_MS = 45_000
const LONG_NO_CAST_GAP_MS = 10_000

const CONSUMABLE_ABILITY_NAMES = ['potion', 'healthstone']
const DEFENSIVE_ABILITY_NAMES = [
  'barkskin',
  'shield wall',
  'ice block',
  'survival instincts',
  'astral shift',
  'blur',
  'fortifying brew',
  'divine protection',
]
const INTERRUPT_ABILITY_NAMES = ['interrupt', 'counterspell', 'rebuke', 'kick', 'pummel', 'spell lock', 'wind shear']
const DISPEL_ABILITY_NAMES = ['dispel', 'purify', 'cleanse', 'remove corruption']

const toPositiveNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value
}

const toAbilityName = (event: WclRawEvent): string => event.ability?.name ?? 'Unknown ability'

const includesKnownToken = (abilityName: string, tokens: string[]): boolean => {
  const normalized = abilityName.toLowerCase()
  return tokens.some((token) => normalized.includes(token))
}

const mapDamageEvent = (event: WclRawEvent, fightStartTime: number, sourceName?: string | null): WclFightDamageEvent => {
  const eventTimestamp = toPositiveNumber(event.timestamp) ?? fightStartTime

  return {
    timestampRelativeMs: Math.max(Math.floor(eventTimestamp - fightStartTime), 0),
    abilityId: event.ability?.gameID ?? null,
    abilityName: toAbilityName(event),
    sourceName: sourceName ?? null,
    amount: toPositiveNumber(event.amount),
  }
}

const mapPlayerReviewEvent = (params: {
  event: WclRawEvent
  fightStartTime: number
  eventType: string
  actorById: Map<number, WclActor>
}): WclPlayerReviewEvent => {
  const eventTimestamp = toPositiveNumber(params.event.timestamp) ?? params.fightStartTime
  const sourceName = params.actorById.get(params.event.sourceID ?? -1)?.name ?? null
  const targetName = params.actorById.get(params.event.targetID ?? -1)?.name ?? null

  return {
    timestampRelativeMs: Math.max(Math.floor(eventTimestamp - params.fightStartTime), 0),
    eventType: params.eventType,
    abilityId: params.event.ability?.gameID ?? null,
    abilityName: toAbilityName(params.event),
    sourceName,
    targetName,
    amount: toPositiveNumber(params.event.amount),
  }
}

const sortEventsByTimestamp = (events: WclRawEvent[]): WclRawEvent[] =>
  [...events]
    .filter((event) => typeof event.timestamp === 'number')
    .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0))

const mapParticipants = (actors: WclActor[] = []): WclFightParticipant[] =>
  actors
    .filter((actor) => actor.id > 0)
    .map((actor) => ({
      id: actor.id,
      name: actor.name ?? `Unknown actor ${actor.id}`,
      type: actor.type ?? null,
      className: actor.subType ?? null,
      icon: actor.icon ?? null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

const buildSourceNote = (params: { participantPartial: boolean; deathsPartial: boolean }): string => {
  const notes: string[] = []

  if (params.participantPartial) {
    notes.push('Participant data may be incomplete from source events.')
  }

  if (params.deathsPartial) {
    notes.push('Death timeline and pre-death damage evidence may be partial.')
  }

  if (!notes.length) {
    return 'Fight review includes report metadata, participants, and death evidence from available source events.'
  }

  return notes.join(' ')
}

const isNotFoundMessage = (value: string): boolean =>
  value.toLowerCase().includes('no report found') || value.toLowerCase().includes('not found')

const toActorMap = (actors: WclActor[] = []): Map<number, WclActor> => {
  const actorMap = new Map<number, WclActor>()

  actors.forEach((actor) => {
    if (actor.id > 0) {
      actorMap.set(actor.id, actor)
    }
  })

  return actorMap
}

const mapFightDeaths = (params: {
  deaths: WclRawEvent[]
  damageTaken: WclRawEvent[]
  actorById: Map<number, WclActor>
  fightStartTime: number
  reportStartTime: number
}): WclFightDeathSummary[] => {
  const sortedDeaths = [...params.deaths]
    .filter((event) => typeof event.targetID === 'number' && typeof event.timestamp === 'number')
    .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0))

  const sortedDamageTaken = [...params.damageTaken]
    .filter((event) => typeof event.targetID === 'number' && typeof event.timestamp === 'number')
    .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0))

  return sortedDeaths.map((deathEvent) => {
    const deathTimestamp = deathEvent.timestamp ?? params.fightStartTime
    const playerId = deathEvent.targetID ?? -1
    const playerActor = params.actorById.get(playerId)

    const playerDamageWindow = sortedDamageTaken.filter((damageEvent) => {
      if (damageEvent.targetID !== playerId) {
        return false
      }

      const eventTimestamp = damageEvent.timestamp ?? 0
      return eventTimestamp >= deathTimestamp - DAMAGE_WINDOW_MS && eventTimestamp <= deathTimestamp
    })

    const recentDamageEvents = playerDamageWindow.map((damageEvent) =>
      mapDamageEvent(
        damageEvent,
        params.fightStartTime,
        params.actorById.get(damageEvent.sourceID ?? -1)?.name ?? null
      )
    )

    const finalDamageSource = params.actorById.get(deathEvent.sourceID ?? -1)
    const finalDamageEvent = mapDamageEvent(deathEvent, params.fightStartTime, finalDamageSource?.name ?? null)

    return {
      playerId,
      playerName: playerActor?.name ?? `Unknown actor ${playerId}`,
      className: playerActor?.subType ?? null,
      deathTime: params.reportStartTime + deathTimestamp,
      deathTimestampRelativeMs: Math.max(Math.floor(deathTimestamp - params.fightStartTime), 0),
      finalDamageEvent,
      recentDamageEvents,
    }
  })
}

const filterEventsByPlayer = (params: {
  events: WclRawEvent[]
  playerId: number
  mode: 'source' | 'target' | 'either'
}): WclRawEvent[] => {
  if (params.mode === 'source') {
    return params.events.filter((event) => event.sourceID === params.playerId)
  }

  if (params.mode === 'target') {
    return params.events.filter((event) => event.targetID === params.playerId)
  }

  return params.events.filter((event) => event.sourceID === params.playerId || event.targetID === params.playerId)
}

const mapPlayerEvents = (params: {
  events: WclRawEvent[]
  fightStartTime: number
  eventType: string
  actorById: Map<number, WclActor>
}): WclPlayerReviewEvent[] =>
  sortEventsByTimestamp(params.events).map((event) =>
    mapPlayerReviewEvent({
      event,
      fightStartTime: params.fightStartTime,
      eventType: params.eventType,
      actorById: params.actorById,
    })
  )

const calculateLongNoCastGaps = (casts: WclPlayerReviewEvent[]): number[] => {
  if (casts.length < 2) {
    return []
  }

  const gaps: number[] = []

  for (let index = 1; index < casts.length; index += 1) {
    const gap = casts[index].timestampRelativeMs - casts[index - 1].timestampRelativeMs
    if (gap >= LONG_NO_CAST_GAP_MS) {
      gaps.push(gap)
    }
  }

  return gaps
}

const buildPlayerReviewSourceNote = (limitations: string[]): string => {
  if (!limitations.length) {
    return 'Player review includes evidence from available fight events with cautious interpretation.'
  }

  return `Data may be partial. ${limitations.join(' ')}`
}

const buildPlayerReviewFindings = (params: {
  deaths: WclFightDeathSummary[]
  openerCasts: WclPlayerReviewEvent[]
  longNoCastGapsMs: number[]
  consumableEvents: WclPlayerReviewEvent[]
  defensiveEvents: WclPlayerReviewEvent[]
  interruptEvents: WclPlayerReviewEvent[]
  dispelEvents: WclPlayerReviewEvent[]
  limitations: string[]
}): WclPlayerReviewFinding[] => {
  const findings: WclPlayerReviewFinding[] = []

  if (params.deaths.length) {
    findings.push({
      id: 'survivability-death-evidence',
      category: 'survivability',
      severity: params.deaths.length > 1 ? 'critical' : 'warning',
      confidence: 'medium',
      title: params.deaths.length > 1 ? 'Multiple deaths detected' : 'Death detected',
      summary:
        params.deaths.length > 1
          ? `Multiple deaths were recorded for this player in the pull. Review final lethal events and the previous ${DAMAGE_WINDOW_MS / 1000}s damage windows.`
          : `A death was recorded for this player in the pull. Review final lethal event and the previous ${DAMAGE_WINDOW_MS / 1000}s damage window.`,
      evidence: params.deaths.flatMap((death) => [
        {
          timestampRelativeMs: death.deathTimestampRelativeMs,
          eventType: 'death',
          abilityId: death.finalDamageEvent?.abilityId ?? null,
          abilityName: death.finalDamageEvent?.abilityName ?? 'Unknown ability',
          sourceName: death.finalDamageEvent?.sourceName ?? null,
          amount: death.finalDamageEvent?.amount ?? null,
        },
      ]),
    })
  }

  if (!params.openerCasts.length) {
    findings.push({
      id: 'execution-empty-opener',
      category: 'execution',
      severity: 'warning',
      confidence: 'medium',
      title: 'No opener casts detected',
      summary:
        'No player casts were detected in the first 45 seconds from available events. This may be affected by source event completeness.',
      evidence: [],
      limitation: 'Movement, downtime, or missing event pages can affect this signal.',
    })
  }

  if (params.longNoCastGapsMs.length) {
    findings.push({
      id: 'execution-long-gaps',
      category: 'execution',
      severity: 'warning',
      confidence: 'medium',
      title: 'Long no-cast gaps detected',
      summary: `Detected ${params.longNoCastGapsMs.length} gap(s) of ${LONG_NO_CAST_GAP_MS / 1000}s or longer between casts. Review movement, assignments, and fight downtime context.`,
      evidence: [],
      limitation: 'Long gaps are evidence for review, not definitive mistakes.',
    })
  }

  if (!params.consumableEvents.length) {
    findings.push({
      id: 'survivability-no-consumable-detected',
      category: 'survivability',
      severity: 'info',
      confidence: 'low',
      title: 'No recognized consumable event detected',
      summary: 'No recognized potion or healthstone event was detected from available fight events.',
      evidence: [],
      limitation: 'Consumable detection is generic and may miss some event patterns.',
    })
  }

  if (params.deaths.length && !params.defensiveEvents.length) {
    findings.push({
      id: 'survivability-no-defensive-detected',
      category: 'survivability',
      severity: 'warning',
      confidence: 'low',
      title: 'No recognized defensive event detected',
      summary:
        'No recognized defensive event was detected for this player from available events. Review manually alongside incoming damage windows.',
      evidence: [],
      limitation: 'Defensive detection is based on a small generic ability-name list.',
    })
  }

  if (params.interruptEvents.length || params.dispelEvents.length) {
    findings.push({
      id: 'utility-events-detected',
      category: 'utility',
      severity: 'info',
      confidence: 'medium',
      title: 'Utility events detected',
      summary: `Detected ${params.interruptEvents.length} recognized interrupt event(s) and ${params.dispelEvents.length} recognized dispel event(s).`,
      evidence: [...params.interruptEvents.slice(0, 3), ...params.dispelEvents.slice(0, 3)],
    })
  }

  if (params.limitations.length) {
    findings.push({
      id: 'confidence-partial-source',
      category: 'confidence',
      severity: 'info',
      confidence: 'high',
      title: 'Source limitations detected',
      summary: 'One or more evidence categories may be partial based on available source events.',
      evidence: [],
      limitation: params.limitations.join(' '),
    })
  }

  return findings
}

const toBossFightContext = (report: WclReportDetails): AggregatedFightContext[] =>
  report.fights
    .filter((fight) => fight.encounterId > 0)
    .map((fight) => {
      const absoluteStartTime = report.startTime + fight.startTime
      const absoluteEndTime = report.startTime + fight.endTime

      return {
        reportCode: report.code,
        reportTitle: report.title,
        reportStartTime: report.startTime,
        reportUrl: report.url,
        fightId: fight.id,
        encounterId: fight.encounterId,
        encounterName: fight.encounterName || `Unknown encounter ${fight.encounterId}`,
        kill: fight.kill,
        difficulty: fight.difficulty,
        startTime: absoluteStartTime,
        endTime: absoluteEndTime,
        durationMs: Math.max(absoluteEndTime - absoluteStartTime, 0),
      }
    })

const aggregateRecentBossData = async (
  config: WclConfig
): Promise<{
  source: AggregatedBossSource
  fights: AggregatedFightContext[]
}> => {
  const recentReports = await WclService.listRecentReports(config, RECENT_REPORT_LIMIT)

  if (!recentReports.length) {
    return {
      source: {
        reportCount: 0,
        note: buildAggregationNote({
          reportCount: 0,
          failedReportCount: 0,
        }),
      },
      fights: [],
    }
  }

  const reportDetailsResult = await Promise.allSettled(
    recentReports.map((report) => WclService.getReportDetails(config, report.code))
  )

  const successfulDetails = reportDetailsResult
    .filter((result): result is PromiseFulfilledResult<WclReportDetails> => result.status === 'fulfilled')
    .map((result) => result.value)

  const failedReportCount = reportDetailsResult.length - successfulDetails.length

  return {
    source: {
      reportCount: recentReports.length,
      note: buildAggregationNote({
        reportCount: recentReports.length,
        failedReportCount,
      }),
    },
    fights: successfulDetails.flatMap(toBossFightContext),
  }
}

export const WclService = {
  listRecentReports: async (config: WclConfig, limit = RECENT_REPORT_LIMIT): Promise<WclReportSummary[]> => {
    const queryResponse = await queryWclGraphQl<ReportsQueryResponse>({
      config,
      query: REPORTS_BY_GUILD_QUERY,
      variables: {
        guildId: Number(config.WCL_GUILD_ID),
        limit,
      },
    })

    const reports = queryResponse.reportData?.reports?.data ?? []

    return reports.map((report) => ({
      code: report.code,
      title: report.title,
      startTime: report.startTime,
      endTime: report.endTime,
      visibility: report.visibility,
      ownerName: report.owner?.name ?? null,
      zoneName: report.zone?.name ?? null,
      url: `https://www.warcraftlogs.com/reports/${report.code}`,
    }))
  },

  getReportDetails: async (config: WclConfig, code: string): Promise<WclReportDetails> => {
    const queryResponse = await queryWclGraphQl<ReportDetailsQueryResponse>({
      config,
      query: REPORT_DETAILS_QUERY,
      variables: {
        code,
      },
    })

    const report = queryResponse.reportData?.report

    if (!report) {
      throw new Error(`No report found for code: ${code}`)
    }

    return {
      code: report.code,
      title: report.title,
      startTime: report.startTime,
      endTime: report.endTime,
      visibility: report.visibility,
      ownerName: report.owner?.name ?? null,
      zoneName: report.zone?.name ?? null,
      fights: mapFights(report.fights),
      url: `https://www.warcraftlogs.com/reports/${report.code}`,
    }
  },

  getFightReview: async (config: WclConfig, code: string, fightId: number): Promise<WclFightReview> => {
    if (!Number.isFinite(fightId) || fightId <= 0) {
      throw createWclServiceError('Invalid fight ID. Expected a positive number.', 'BAD_REQUEST')
    }

    const reportDetails = await WclService.getReportDetails(config, code).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to load report details.'

      if (isNotFoundMessage(message)) {
        throw createWclServiceError(`No report found for code: ${code}`, 'NOT_FOUND')
      }

      throw createWclServiceError('Failed to load report details from Warcraft Logs.', 'UPSTREAM')
    })

    const fight = reportDetails.fights.find((fightItem) => fightItem.id === fightId)

    if (!fight) {
      throw createWclServiceError(`Fight ${fightId} was not found for report ${code}.`, 'NOT_FOUND')
    }

    const queryResponse = await queryWclGraphQl<FightReviewQueryResponse>({
      config,
      query: FIGHT_REVIEW_QUERY,
      variables: {
        code,
        fightId,
        startTime: fight.startTime,
        endTime: fight.endTime,
      },
    }).catch(() => {
      throw createWclServiceError('Failed to load fight event evidence from Warcraft Logs.', 'UPSTREAM')
    })

    const report = queryResponse.reportData?.report

    if (!report) {
      throw createWclServiceError(`No report found for code: ${code}`, 'NOT_FOUND')
    }

    const selectedFight = report.fights?.find((fightItem) => fightItem.id === fightId)

    if (!selectedFight) {
      throw createWclServiceError(`Fight ${fightId} was not found for report ${code}.`, 'NOT_FOUND')
    }

    const actorById = toActorMap(report.masterData?.actors ?? [])
    const participants = mapParticipants(report.masterData?.actors ?? []).filter(
      (participant) => participant.type === 'Player' || participant.className != null
    )

    const playerActorIds = new Set(participants.map((p) => p.id))

    const deaths = (report.deaths?.data ?? []).filter(
      (event) => typeof event.targetID === 'number' && playerActorIds.has(event.targetID)
    )
    const damageTaken = report.damageTaken?.data ?? []

    const mappedDeaths = mapFightDeaths({
      deaths,
      damageTaken,
      actorById,
      fightStartTime: selectedFight.startTime,
      reportStartTime: report.startTime,
    })

    const participantPartial = participants.length === 0
    const deathsPartial = Boolean(report.deaths?.nextPageTimestamp || report.damageTaken?.nextPageTimestamp)

    const absoluteStartTime = report.startTime + selectedFight.startTime
    const absoluteEndTime = report.startTime + selectedFight.endTime

    return {
      reportCode: report.code,
      reportTitle: report.title,
      reportUrl: `https://www.warcraftlogs.com/reports/${report.code}`,
      fightId: selectedFight.id,
      encounterId: selectedFight.encounterID,
      encounterName: selectedFight.name ?? `Unknown encounter ${selectedFight.encounterID}`,
      kill: selectedFight.kill,
      difficulty: selectedFight.difficulty,
      startTime: absoluteStartTime,
      endTime: absoluteEndTime,
      durationMs: Math.max(absoluteEndTime - absoluteStartTime, 0),
      participants,
      deaths: mappedDeaths,
      source: {
        note: buildSourceNote({
          participantPartial,
          deathsPartial,
        }),
        partial: participantPartial || deathsPartial,
      },
    }
  },

  getPlayerFightReview: async (
    config: WclConfig,
    code: string,
    fightId: number,
    playerId: number
  ): Promise<WclPlayerFightReview> => {
    if (!Number.isFinite(fightId) || fightId <= 0) {
      throw createWclServiceError('Invalid fight ID. Expected a positive number.', 'BAD_REQUEST')
    }

    if (!Number.isFinite(playerId) || playerId <= 0) {
      throw createWclServiceError('Invalid player ID. Expected a positive number.', 'BAD_REQUEST')
    }

    const reportDetails = await WclService.getReportDetails(config, code).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to load report details.'

      if (isNotFoundMessage(message)) {
        throw createWclServiceError(`No report found for code: ${code}`, 'NOT_FOUND')
      }

      throw createWclServiceError('Failed to load report details from Warcraft Logs.', 'UPSTREAM')
    })

    const fight = reportDetails.fights.find((fightItem) => fightItem.id === fightId)

    if (!fight) {
      throw createWclServiceError(`Fight ${fightId} was not found for report ${code}.`, 'NOT_FOUND')
    }

    const queryResponse = await queryWclGraphQl<PlayerReviewQueryResponse>({
      config,
      query: PLAYER_REVIEW_QUERY,
      variables: {
        code,
        fightId,
        startTime: fight.startTime,
        endTime: fight.endTime,
      },
    }).catch(() => {
      throw createWclServiceError('Failed to load player fight review evidence from Warcraft Logs.', 'UPSTREAM')
    })

    const report = queryResponse.reportData?.report

    if (!report) {
      throw createWclServiceError(`No report found for code: ${code}`, 'NOT_FOUND')
    }

    const selectedFight = report.fights?.find((fightItem) => fightItem.id === fightId)

    if (!selectedFight) {
      throw createWclServiceError(`Fight ${fightId} was not found for report ${code}.`, 'NOT_FOUND')
    }

    const actorById = toActorMap(report.masterData?.actors ?? [])
    const selectedPlayer = actorById.get(playerId)

    if (!selectedPlayer || (selectedPlayer.type !== 'Player' && !selectedPlayer.subType)) {
      throw createWclServiceError(`Player ${playerId} was not found in fight ${fightId}.`, 'NOT_FOUND')
    }

    const fightDurationMs = Math.max(selectedFight.endTime - selectedFight.startTime, 0)
    const absoluteStartTime = report.startTime + selectedFight.startTime
    const absoluteEndTime = report.startTime + selectedFight.endTime

    const castsRaw = report.casts?.data ?? []
    const damageDoneRaw = report.damageDone?.data ?? []
    const damageTakenRaw = report.damageTaken?.data ?? []
    const deathsRaw = report.deaths?.data ?? []
    const buffsRaw = report.buffs?.data ?? []

    const playerCastEvents = mapPlayerEvents({
      events: filterEventsByPlayer({ events: castsRaw, playerId, mode: 'source' }),
      fightStartTime: selectedFight.startTime,
      eventType: 'cast',
      actorById,
    })

    const playerDamageDoneEvents = mapPlayerEvents({
      events: filterEventsByPlayer({ events: damageDoneRaw, playerId, mode: 'source' }),
      fightStartTime: selectedFight.startTime,
      eventType: 'damageDone',
      actorById,
    })

    const playerDamageTakenEvents = mapPlayerEvents({
      events: filterEventsByPlayer({ events: damageTakenRaw, playerId, mode: 'target' }),
      fightStartTime: selectedFight.startTime,
      eventType: 'damageTaken',
      actorById,
    })

    const playerBuffEvents = mapPlayerEvents({
      events: filterEventsByPlayer({ events: buffsRaw, playerId, mode: 'either' }),
      fightStartTime: selectedFight.startTime,
      eventType: 'buff',
      actorById,
    })

    const playerDeaths = mapFightDeaths({
      deaths: filterEventsByPlayer({ events: deathsRaw, playerId, mode: 'target' }),
      damageTaken: filterEventsByPlayer({ events: damageTakenRaw, playerId, mode: 'target' }),
      actorById,
      fightStartTime: selectedFight.startTime,
      reportStartTime: report.startTime,
    })

    const knownCastEvents = playerCastEvents.filter((event) => event.abilityName !== 'Unknown ability')
    const unknownAbilityCount = playerCastEvents.length - knownCastEvents.length

    const openerEvents = knownCastEvents.filter((event) => event.timestampRelativeMs <= OPENER_WINDOW_MS)
    const longNoCastGapsMs = calculateLongNoCastGaps(knownCastEvents)

    const consumableEvents = playerBuffEvents.filter((event) => includesKnownToken(event.abilityName, CONSUMABLE_ABILITY_NAMES))
    const defensiveEvents = playerBuffEvents.filter((event) => includesKnownToken(event.abilityName, DEFENSIVE_ABILITY_NAMES))
    const interruptEvents = knownCastEvents.filter((event) => includesKnownToken(event.abilityName, INTERRUPT_ABILITY_NAMES))
    const dispelEvents = knownCastEvents.filter((event) => includesKnownToken(event.abilityName, DISPEL_ABILITY_NAMES))

    const totalDamageDone = playerDamageDoneEvents.reduce((sum, event) => sum + (event.amount ?? 0), 0)
    const castCount = knownCastEvents.length
    const castsPerMinute = fightDurationMs > 0 ? Number(((castCount * 60_000) / fightDurationMs).toFixed(2)) : 0

    const limitations: string[] = []

    if (report.casts?.nextPageTimestamp) {
      limitations.push('Cast events may be partial because event pagination returned additional pages.')
    }

    if (report.damageDone?.nextPageTimestamp) {
      limitations.push('Damage done events may be partial because event pagination returned additional pages.')
    }

    if (report.damageTaken?.nextPageTimestamp) {
      limitations.push('Damage taken events may be partial because event pagination returned additional pages.')
    }

    if (report.deaths?.nextPageTimestamp) {
      limitations.push('Death events may be partial because event pagination returned additional pages.')
    }

    if (report.buffs?.nextPageTimestamp) {
      limitations.push('Buff/consumable/defensive evidence may be partial because event pagination returned additional pages.')
    }

    if (unknownAbilityCount > 0) {
      limitations.push(
        `${unknownAbilityCount} cast event(s) had no ability name from WCL and were excluded from the cast timeline.`
      )
    }

    limitations.push('Assignment context is unknown and may change interpretation of activity and utility events.')

    const findings = buildPlayerReviewFindings({
      deaths: playerDeaths,
      openerCasts: openerEvents,
      longNoCastGapsMs,
      consumableEvents,
      defensiveEvents,
      interruptEvents,
      dispelEvents,
      limitations,
    })

    const sourceNote = buildPlayerReviewSourceNote(limitations)

    return {
      reportCode: report.code,
      reportTitle: report.title,
      reportUrl: `https://www.warcraftlogs.com/reports/${report.code}`,
      fight: {
        id: selectedFight.id,
        encounterId: selectedFight.encounterID,
        encounterName: selectedFight.name ?? `Unknown encounter ${selectedFight.encounterID}`,
        kill: selectedFight.kill,
        difficulty: selectedFight.difficulty,
        startTime: absoluteStartTime,
        endTime: absoluteEndTime,
        durationMs: fightDurationMs,
      },
      player: {
        id: selectedPlayer.id,
        name: selectedPlayer.name ?? `Unknown player ${selectedPlayer.id}`,
        type: selectedPlayer.type ?? null,
        className: selectedPlayer.subType ?? null,
        icon: selectedPlayer.icon ?? null,
      },
      assignmentContext: {
        status: 'Unknown',
        note: 'Assignment context is unknown in PR03. Interpretation may change when assignment tagging exists.',
      },
      evidence: {
        context: {
          summary: 'Assignment and mechanic responsibility context is not available in PR03.',
          confidence: 'low',
          limitations: ['Assignment tags are not implemented yet.'],
        },
        output: {
          summary: `Detected ${playerDamageDoneEvents.length} damage-done evidence events from available data.`,
          confidence: report.damageDone?.nextPageTimestamp ? 'low' : 'medium',
          limitations: report.damageDone?.nextPageTimestamp
            ? ['Damage done events may be partial due to pagination.']
            : [],
          damageDoneEvents: playerDamageDoneEvents.slice(0, 25),
          totalDamageDone,
        },
        execution: {
          summary: `Detected ${castCount} cast events with ${longNoCastGapsMs.length} long no-cast gap(s).`,
          confidence: report.casts?.nextPageTimestamp ? 'low' : 'medium',
          limitations: report.casts?.nextPageTimestamp
            ? ['Cast events may be partial due to pagination.']
            : ['Long no-cast gaps can be caused by movement, downtime, or assignments.'],
          openerEvents,
          casts: knownCastEvents.slice(0, 120),
          castCount,
          castsPerMinute,
          longNoCastGapsMs,
        },
        survivability: {
          summary: `Detected ${playerDeaths.length} death event(s), ${playerDamageTakenEvents.length} damage-taken event(s), and ${defensiveEvents.length} recognized defensive event(s).`,
          confidence: report.damageTaken?.nextPageTimestamp || report.deaths?.nextPageTimestamp ? 'low' : 'medium',
          limitations:
            report.damageTaken?.nextPageTimestamp || report.deaths?.nextPageTimestamp
              ? ['Damage taken and/or death windows may be partial due to pagination.']
              : ['Defensive and consumable detection uses generic ability-name matching.'],
          deaths: playerDeaths,
          damageTakenEvents: playerDamageTakenEvents.slice(0, 80),
          defensiveEvents: defensiveEvents.slice(0, 30),
          consumableEvents: consumableEvents.slice(0, 30),
        },
        utility: {
          summary: `Detected ${interruptEvents.length} recognized interrupt event(s) and ${dispelEvents.length} recognized dispel event(s) from available events.`,
          confidence: 'low',
          limitations: ['Utility detection is generic and based on recognizable cast names in available events.'],
          interrupts: interruptEvents,
          dispels: dispelEvents,
        },
        consistency: {
          summary: 'Consistency/trend evidence is a placeholder in PR03 and requires multi-pull historical context.',
          confidence: 'low',
          limitations: ['Cross-pull trend analysis is out of scope for PR03.'],
        },
        confidence: {
          summary: sourceNote,
          confidence: limitations.length ? 'low' : 'medium',
          limitations,
        },
      },
      topFindings: findings,
      source: {
        note: sourceNote,
        partial: Boolean(
          report.casts?.nextPageTimestamp ||
            report.damageDone?.nextPageTimestamp ||
            report.damageTaken?.nextPageTimestamp ||
            report.deaths?.nextPageTimestamp ||
            report.buffs?.nextPageTimestamp
        ),
        limitations,
      },
    }
  },

  listRecentBosses: async (config: WclConfig): Promise<WclRecentBossesResponse> => {
    const aggregatedData = await aggregateRecentBossData(config)
    const bossMap = new Map<number, WclBossSummary>()

    aggregatedData.fights.forEach((fight) => {
      const existingBoss = bossMap.get(fight.encounterId)

      if (!existingBoss) {
        bossMap.set(fight.encounterId, {
          encounterId: fight.encounterId,
          encounterName: fight.encounterName || `Unknown encounter ${fight.encounterId}`,
          pullCount: 1,
          killCount: fight.kill ? 1 : 0,
          wipeCount: fight.kill ? 0 : 1,
          lastSeenAt: fight.startTime,
          difficulties: [fight.difficulty],
          recentReports: [
            {
              code: fight.reportCode,
              title: fight.reportTitle,
              startTime: fight.reportStartTime,
            },
          ],
        })
        return
      }

      existingBoss.pullCount += 1
      existingBoss.killCount += fight.kill ? 1 : 0
      existingBoss.wipeCount += fight.kill ? 0 : 1
      existingBoss.lastSeenAt = Math.max(existingBoss.lastSeenAt, fight.startTime)

      if (!existingBoss.difficulties.includes(fight.difficulty)) {
        existingBoss.difficulties.push(fight.difficulty)
      }

      if (!existingBoss.recentReports.some((report) => report.code === fight.reportCode)) {
        existingBoss.recentReports.push({
          code: fight.reportCode,
          title: fight.reportTitle,
          startTime: fight.reportStartTime,
        })
      }
    })

    const bosses = Array.from(bossMap.values())
      .map((boss) => ({
        ...boss,
        difficulties: [...boss.difficulties].sort((left, right) => left - right),
        recentReports: [...boss.recentReports]
          .sort((left, right) => right.startTime - left.startTime)
          .slice(0, 5),
      }))
      .sort((left, right) => {
        if (right.lastSeenAt !== left.lastSeenAt) {
          return right.lastSeenAt - left.lastSeenAt
        }

        return left.encounterName.localeCompare(right.encounterName)
      })

    return {
      generatedAt: Date.now(),
      source: aggregatedData.source,
      bosses,
    }
  },

  listRecentBossFights: async (
    config: WclConfig,
    encounterId: number
  ): Promise<WclRecentBossFightsResponse> => {
    const aggregatedData = await aggregateRecentBossData(config)

    const fights: WclBossFightListItem[] = aggregatedData.fights
      .filter((fight) => fight.encounterId === encounterId)
      .sort((left, right) => right.startTime - left.startTime)
      .map((fight) => ({
        reportCode: fight.reportCode,
        reportTitle: fight.reportTitle,
        reportStartTime: fight.reportStartTime,
        fightId: fight.fightId,
        encounterId: fight.encounterId,
        encounterName: fight.encounterName || `Unknown encounter ${fight.encounterId}`,
        kill: fight.kill,
        difficulty: fight.difficulty,
        startTime: fight.startTime,
        endTime: fight.endTime,
        durationMs: fight.durationMs,
        url: fight.reportUrl,
      }))

    return {
      generatedAt: Date.now(),
      source: aggregatedData.source,
      boss: {
        encounterId,
        encounterName: fights[0]?.encounterName ?? `Unknown encounter ${encounterId}`,
      },
      fights,
    }
  },
}
