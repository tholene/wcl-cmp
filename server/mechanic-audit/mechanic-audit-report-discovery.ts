import type { WclConfig } from '../warcraft-logs/wcl-config'
import type { WclSite } from '../warcraft-logs/wcl-site'
import { queryWclGraphQl } from '../warcraft-logs/wcl-client'
import type { MechanicAuditFightRecord, MechanicAuditPlayerInfo } from './mechanic-audit.types'

const MAX_DISCOVERY_PAGES = 200

type GuildReportsPageResponse = {
  reportData: {
    reports: {
      data: Array<{ code: string; title: string; startTime: number; endTime: number }>
      current_page: number
      last_page: number
      has_more_pages: boolean
    } | null
  }
}

const GUILD_REPORTS_PAGE_QUERY = `
  query MechanicAuditGuildReports($guildID: Int!, $page: Int!, $limit: Int!, $startTime: Float, $endTime: Float) {
    reportData {
      reports(guildID: $guildID, page: $page, limit: $limit, startTime: $startTime, endTime: $endTime) {
        data { code title startTime endTime }
        current_page
        last_page
        has_more_pages
      }
    }
  }
`

export type ReportDiscoveryWarning = { message: string; reportCode?: string }

export type DiscoveredReport = { code: string; title: string; startTime: number; endTime: number }

export const discoverReportsByDateRange = async (params: {
  config: WclConfig
  site?: WclSite
  guildId: number
  since: number
  until: number
}): Promise<{ reports: DiscoveredReport[]; warnings: ReportDiscoveryWarning[]; partial: boolean }> => {
  const reports: DiscoveredReport[] = []
  const warnings: ReportDiscoveryWarning[] = []
  let page = 1
  let partial = false

  while (page <= MAX_DISCOVERY_PAGES) {
    try {
      const response = await queryWclGraphQl<GuildReportsPageResponse>({
        config: params.config,
        site: params.site,
        query: GUILD_REPORTS_PAGE_QUERY,
        variables: {
          guildID: params.guildId,
          page,
          limit: 25,
          startTime: params.since,
          endTime: params.until,
        },
      })

      const pageData = response.reportData?.reports
      if (!pageData) break

      reports.push(...pageData.data)

      if (!pageData.has_more_pages) break
      page += 1
    } catch (error) {
      partial = true
      warnings.push({
        message: `Report discovery stopped early on page ${page}: ${error instanceof Error ? error.message : 'unknown error'}`,
      })
      break
    }
  }

  if (page > MAX_DISCOVERY_PAGES) {
    partial = true
    warnings.push({ message: `Report discovery hit the ${MAX_DISCOVERY_PAGES}-page safety cap; results may be incomplete.` })
  }

  return { reports, warnings, partial }
}

export const normalizeManualReportCodes = (input: string | string[]): string[] => {
  const raw = Array.isArray(input) ? input.join(',') : input
  const parts = raw
    .split(/[\s,]+/)
    .map((code) => code.trim())
    .filter((code) => code.length > 0)
  return [...new Set(parts)]
}

type ReportFightsAndMasterDataResponse = {
  reportData: {
    report: {
      code: string
      title: string
      startTime: number
      fights: Array<{
        id: number
        kill: boolean | null
        startTime: number
        endTime: number
        bossPercentage: number | null
        encounterID: number
        difficulty: number | null
        friendlyPlayers: number[] | null
        phaseTransitions: Array<{ id: number; startTime: number }> | null
      }> | null
      masterData: {
        actors: Array<{ id: number; name: string; type: string; subType: string }>
      } | null
    } | null
  }
}

const REPORT_FIGHTS_AND_MASTER_DATA_QUERY = `
  query MechanicAuditReportFights($code: String!, $encounterID: Int!, $difficulty: Int) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        fights(encounterID: $encounterID, difficulty: $difficulty, translate: true) {
          id
          kill
          startTime
          endTime
          bossPercentage
          encounterID
          difficulty
          friendlyPlayers
          phaseTransitions { id startTime }
        }
        masterData(translate: true) {
          actors { id name type subType }
        }
      }
    }
  }
`

export type DiscoveredFight = Omit<
  MechanicAuditFightRecord,
  | 'pullNumber'
  | 'phaseOneEndReportRelativeMs'
  | 'phaseOneEndFightRelativeMs'
  | 'phaseBoundarySource'
  | 'phaseBoundaryWarning'
  | 'isDuplicate'
  | 'duplicateGroupId'
  | 'canonicalReportCode'
  | 'duplicateReportCodes'
  | 'deduplicationConfidence'
>

export type ReportFightsResult = {
  reportCode: string
  reportTitle: string
  reportStartTime: number
  encounterName: string
  fights: DiscoveredFight[]
  phaseTransitionsByFightId: Map<number, Array<{ id: number; startTime: number }>>
  players: Map<number, MechanicAuditPlayerInfo>
}

export const fetchReportFightsAndPlayers = async (params: {
  config: WclConfig
  site?: WclSite
  reportCode: string
  encounterId: number
  encounterName?: string
  difficulty: number
}): Promise<ReportFightsResult | null> => {
  const response = await queryWclGraphQl<ReportFightsAndMasterDataResponse>({
    config: params.config,
    site: params.site,
    query: REPORT_FIGHTS_AND_MASTER_DATA_QUERY,
    variables: {
      code: params.reportCode,
      encounterID: params.encounterId,
      difficulty: params.difficulty,
    },
  })

  const report = response.reportData?.report
  if (!report) return null

  const actors = report.masterData?.actors ?? []
  const playerActorIds = new Set(actors.filter((actor) => actor.type === 'Player').map((actor) => actor.id))
  const players = new Map<number, MechanicAuditPlayerInfo>()
  for (const actor of actors) {
    if (actor.type !== 'Player') continue
    players.set(actor.id, { playerId: actor.id, playerName: actor.name, playerClass: actor.subType ?? null })
  }

  const fights: DiscoveredFight[] = []
  const phaseTransitionsByFightId = new Map<number, Array<{ id: number; startTime: number }>>()

  for (const fight of report.fights ?? []) {
    fights.push({
      reportCode: report.code,
      reportTitle: report.title,
      reportStartTime: report.startTime,
      fightId: fight.id,
      encounterId: fight.encounterID,
      encounterName: params.encounterName ?? '',
      difficulty: fight.difficulty ?? params.difficulty,
      kill: fight.kill ?? false,
      fightStartTime: fight.startTime,
      fightEndTime: fight.endTime,
      durationMs: fight.endTime - fight.startTime,
      bossPercentage: fight.bossPercentage,
      // friendlyPlayers() is the official WCL participation field; cross-filter against
      // masterData actor types as a defensive guard against pets/NPCs ever leaking in.
      friendlyPlayerIds: (fight.friendlyPlayers ?? []).filter((id) => playerActorIds.size === 0 || playerActorIds.has(id)),
    })
    phaseTransitionsByFightId.set(fight.id, fight.phaseTransitions ?? [])
  }

  return {
    reportCode: report.code,
    reportTitle: report.title,
    reportStartTime: report.startTime,
    encounterName: params.encounterName ?? '',
    fights,
    phaseTransitionsByFightId,
    players,
  }
}
