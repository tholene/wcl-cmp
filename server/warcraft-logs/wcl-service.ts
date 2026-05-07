import type { WclConfig } from './wcl-config'
import { queryWclGraphQl } from './wcl-client'
import type { WclFightSummary, WclReportDetails, WclReportSummary } from './wcl-types'

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
      encounterName: fight.name ?? 'Unknown Encounter',
      kill: fight.kill,
      difficulty: fight.difficulty,
      startTime: fight.startTime,
      endTime: fight.endTime,
    }))

export const WclService = {
  listRecentReports: async (config: WclConfig, limit = 15): Promise<WclReportSummary[]> => {
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
}
