import type { WclConfig } from './wcl-config'
import { queryWclGraphQl } from './wcl-client'
import { isRaidZone } from './raid-zone-classifier'
import { buildWclReportUrl } from './wcl-site'
import type {
  WclFightSummary,
  WclRecentPlayer,
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
          id?: number | null
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
        id?: number | null
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

type ReportPlayersQueryResponse = {
  reportData?: {
    report?: {
      code: string
      startTime: number
      masterData?: {
        actors?: WclActor[]
      } | null
    } | null
  }
}

const RECENT_REPORT_LIMIT = 15

const REPORTS_BY_GUILD_QUERY = `
  query ReportsByGuild($guildId: Int!, $limit: Int!, $startTime: Float) {
    reportData {
      reports(guildID: $guildId, limit: $limit, startTime: $startTime) {
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
            id
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
`

const REPORT_PLAYERS_QUERY = `
  query ReportPlayers($code: String!) {
    reportData {
      report(code: $code) {
        code
        startTime
        masterData(translate: true) {
          actors {
            id
            name
            type
            subType
            icon
          }
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
    difficulty?: number | null
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
      difficulty: fight.difficulty ?? 0,
      startTime: fight.startTime,
      endTime: fight.endTime,
    }))

export const WclService = {
  listRecentReports: async (config: WclConfig, limit = RECENT_REPORT_LIMIT, startTime?: number): Promise<WclReportSummary[]> => {
    const queryResponse = await queryWclGraphQl<ReportsQueryResponse>({
      config,
      query: REPORTS_BY_GUILD_QUERY,
      variables: {
        guildId: Number(config.WCL_GUILD_ID),
        limit,
        startTime,
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
      zoneId: report.zone?.id ?? null,
      zoneName: report.zone?.name ?? null,
      url: buildWclReportUrl(undefined, report.code),
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
      zoneId: report.zone?.id ?? null,
      zoneName: report.zone?.name ?? null,
      fights: mapFights(report.fights),
      url: buildWclReportUrl(undefined, report.code),
    }
  },

  getRecentPlayers: async (config: WclConfig, limit = RECENT_REPORT_LIMIT): Promise<WclRecentPlayer[]> => {
    const reports = await WclService.listRecentReports(config, limit)
    const raidReports = reports.filter(isRaidZone)
    const scopedReports = raidReports.length > 0 ? raidReports : reports
    const playerMap = new Map<string, WclRecentPlayer>()

    if (scopedReports.length === 0) {
      return []
    }

    const reportDetailsResults = await Promise.allSettled(
      scopedReports.map(async (report) => {
        const details = await WclService.getReportDetails(config, report.code)
        const raidKillFights = details.fights.filter((fight) => fight.encounterId > 0 && fight.kill).length
        return { report, raidKillFights }
      })
    )

    const resolvedReports = reportDetailsResults
      .filter((result): result is PromiseFulfilledResult<{ report: WclReportSummary; raidKillFights: number }> => result.status === 'fulfilled')
      .map((result) => result.value)

    const raidKillReports = resolvedReports
      .filter((entry) => entry.raidKillFights > 0)

    const sourceReports = raidKillReports.length > 0 ? raidKillReports : resolvedReports

    await Promise.all(
      sourceReports.map(async ({ report, raidKillFights }) => {
        try {
          const response = await queryWclGraphQl<ReportPlayersQueryResponse>({
            config,
            query: REPORT_PLAYERS_QUERY,
            variables: { code: report.code },
          })

          const actors = response.reportData?.report?.masterData?.actors ?? []
          actors
            .filter((actor) => actor.type === 'Player' && actor.name)
            .forEach((actor) => {
              const name = actor.name ?? 'Unknown Player'
              const normalizedName = name.toLowerCase()
              const existing = playerMap.get(normalizedName)

              if (!existing) {
                playerMap.set(normalizedName, {
                  name,
                  className: actor.subType ?? null,
                  specName: null,
                  role: 'unknown',
                  seenInReportCodes: [report.code],
                  lastSeenAt: report.startTime,
                  seenInRaidKillReports: raidKillFights > 0 ? 1 : 0,
                  seenInRaidKillFights: raidKillFights,
                })
                return
              }

              if (!existing.seenInReportCodes.includes(report.code)) {
                existing.seenInReportCodes.push(report.code)
                existing.seenInRaidKillReports = (existing.seenInRaidKillReports ?? 0) + (raidKillFights > 0 ? 1 : 0)
                existing.seenInRaidKillFights = (existing.seenInRaidKillFights ?? 0) + raidKillFights
              }
              existing.lastSeenAt = Math.max(existing.lastSeenAt ?? 0, report.startTime)
              if (!existing.className && actor.subType) {
                existing.className = actor.subType
                existing.role = 'unknown'
              }
            })
        } catch {
          // Partial failures are intentionally skipped for resilient aggregation.
        }
      })
    )

    return Array.from(playerMap.values()).sort((left, right) => {
      const reportDelta = (right.seenInRaidKillReports ?? 0) - (left.seenInRaidKillReports ?? 0)
      if (reportDelta !== 0) return reportDelta
      const fightDelta = (right.seenInRaidKillFights ?? 0) - (left.seenInRaidKillFights ?? 0)
      if (fightDelta !== 0) return fightDelta
      const seenDelta = (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0)
      if (seenDelta !== 0) return seenDelta
      return left.name.localeCompare(right.name)
    })
  },
}
