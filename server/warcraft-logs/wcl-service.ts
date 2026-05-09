import type { WclConfig } from './wcl-config'
import { queryWclGraphQl } from './wcl-client'
import type {
  WclBossFightListItem,
  WclBossSummary,
  WclFightDamageEvent,
  WclFightDeathSummary,
  WclFightParticipant,
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

const toPositiveNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value
}

const toAbilityName = (event: WclRawEvent): string => event.ability?.name ?? 'Unknown ability'

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
      (participant) => participant.type === 'Player'
    )

    const deaths = report.deaths?.data ?? []
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
