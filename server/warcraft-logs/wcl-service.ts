import type { WclConfig } from './wcl-config'
import { queryWclGraphQl } from './wcl-client'
import type {
  WclBossFightListItem,
  WclBossSummary,
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
