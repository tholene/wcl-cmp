import crypto from 'node:crypto'
import { queryWclGraphQl } from '../warcraft-logs/wcl-client'
import type { WclConfig } from '../warcraft-logs/wcl-config'
import { classifyWclError } from '../warcraft-logs/wcl-error-hints'
import { WclService } from '../warcraft-logs/wcl-service'
import { buildWclReportUrl } from '../warcraft-logs/wcl-site'
import { isRaidZone } from '../warcraft-logs/raid-zone-classifier'
import { fetchDeathEvents } from '../player-analysis/player-analysis-event-fetchers'
import { RosterJobStore } from './roster-review-job-store'
import { parseRosterRankingsPayload, type RosterRankingRow } from './roster-review-rankings'
import {
  buildPlayerEvidence,
  type RosterDeathEvent,
  type RosterReportActor,
  type RosterReportContext,
  type RosterReportFightContext,
} from './roster-review-evidence'
import type {
  RosterEvidenceRequest,
  RosterEvidenceResult,
  RosterEvidenceStartResponse,
  RosterRaidReport,
  RosterRaidReportsResponse,
  RosterRankingTimeframe,
} from './roster-review.types'

// ---------------------------------------------------------------------------
// WCL queries
// ---------------------------------------------------------------------------

type RosterReportQueryResponse = {
  reportData?: {
    report?: {
      code: string
      title: string
      startTime: number
      endTime: number
      zone?: { id?: number | null; name?: string | null } | null
      fights?: Array<{
        id: number
        encounterID: number
        name?: string | null
        kill: boolean
        difficulty?: number | null
        startTime: number
        endTime: number
        friendlyPlayers?: number[] | null
      }> | null
      masterData?: {
        actors?: Array<{
          id: number
          name?: string | null
          type?: string | null
          subType?: string | null
        }> | null
      } | null
    } | null
  }
}

// `friendlyPlayers` is the per-fight participant list (actor ids) on ReportFight.
const ROSTER_REPORT_QUERY = `
  query RosterReport($code: String!) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        endTime
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
          friendlyPlayers
        }
        masterData(translate: true) {
          actors {
            id
            name
            type
            subType
          }
        }
      }
    }
  }
`

type RankingsQueryResponse = {
  reportData?: {
    report?: {
      rankings?: unknown
    } | null
  }
}

// Same shape as the player-analysis parse lookups, but batched across fight ids.
const RANKINGS_HISTORICAL_QUERY = `
  query RosterRankingsHistorical($code: String!, $fightIds: [Int]!) {
    reportData {
      report(code: $code) {
        rankings(fightIDs: $fightIds, timeframe: Historical)
      }
    }
  }
`

const RANKINGS_CURRENT_QUERY = `
  query RosterRankingsCurrent($code: String!, $fightIds: [Int]!) {
    reportData {
      report(code: $code) {
        rankings(fightIDs: $fightIds)
      }
    }
  }
`

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

const DEFAULT_REPORT_LIST_LIMIT = 20
const MAX_REPORT_LIST_LIMIT = 30
const MAX_EVIDENCE_REPORTS = 6
const MAX_EVIDENCE_PLAYERS = 40
const RANKINGS_CHUNK_SIZE = 8
const DEATH_EVENTS_MAX = 600
const DEATH_FETCH_CONCURRENCY = 4

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const asErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : String(error)

const resolveSite = (config: WclConfig): string | undefined => (config as { WCL_SITE?: string }).WCL_SITE

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size))
  return chunks
}

const runWithConcurrency = async <T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> => {
  const queue = [...items]
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const next = queue.shift()
      if (next === undefined) return
      await worker(next)
    }
  })
  await Promise.all(runners)
}

type LoadedReport = {
  code: string
  title: string
  url: string
  startTime: number
  endTime: number
  zoneId: number | null
  zoneName: string | null
  actors: RosterReportActor[]
  fights: RosterReportFightContext[]
  friendlyPlayersAvailable: boolean
}

const loadReport = async (config: WclConfig, code: string): Promise<LoadedReport> => {
  const response = await queryWclGraphQl<RosterReportQueryResponse>({
    config,
    query: ROSTER_REPORT_QUERY,
    variables: { code },
  })
  const report = response.reportData?.report
  if (!report) throw new Error(`No report found for code: ${code}`)

  const actors: RosterReportActor[] = (report.masterData?.actors ?? [])
    .filter((actor) => actor.type === 'Player' && typeof actor.name === 'string' && actor.name.trim().length > 0)
    .map((actor) => ({ id: actor.id, name: actor.name as string, className: actor.subType ?? null }))

  const rawFights = report.fights ?? []
  const friendlyPlayersAvailable = rawFights.some((fight) => Array.isArray(fight.friendlyPlayers))
  const fights: RosterReportFightContext[] = rawFights
    .filter((fight) => fight.encounterID > 0)
    .map((fight) => ({
      id: fight.id,
      encounterId: fight.encounterID,
      encounterName: fight.name ?? `Unknown encounter ${fight.encounterID}`,
      difficulty: fight.difficulty ?? 0,
      kill: fight.kill,
      startTime: fight.startTime,
      endTime: fight.endTime,
      friendlyPlayers: Array.isArray(fight.friendlyPlayers) ? fight.friendlyPlayers : null,
    }))

  return {
    code: report.code,
    title: report.title,
    url: buildWclReportUrl(resolveSite(config), report.code),
    startTime: report.startTime,
    endTime: report.endTime,
    zoneId: report.zone?.id ?? null,
    zoneName: report.zone?.name ?? null,
    actors,
    fights,
    friendlyPlayersAvailable,
  }
}

// ---------------------------------------------------------------------------
// Recent raid reports (raid window step)
// ---------------------------------------------------------------------------

export const listRosterRaidReports = async (
  config: WclConfig,
  options?: { limit?: number }
): Promise<RosterRaidReportsResponse> => {
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_REPORT_LIST_LIMIT, 1), MAX_REPORT_LIST_LIMIT)
  const warnings: string[] = []
  const recent = await WclService.listRecentReports(config, limit)
  const raidReports = recent.filter(isRaidZone)

  if (raidReports.length === 0) {
    warnings.push(`No raid reports found in the last ${recent.length} guild reports.`)
  }

  const results = await Promise.allSettled(raidReports.map((report) => loadReport(config, report.code)))
  const reports: RosterRaidReport[] = []

  results.forEach((result, index) => {
    const summary = raidReports[index]
    if (result.status === 'rejected') {
      warnings.push(`Could not load report ${summary.code}: ${asErrorMessage(result.reason)}`)
      return
    }
    const loaded = result.value
    const killCountsByDifficulty: Record<string, number> = {}
    for (const fight of loaded.fights) {
      if (!fight.kill) continue
      const key = String(fight.difficulty)
      killCountsByDifficulty[key] = (killCountsByDifficulty[key] ?? 0) + 1
    }
    reports.push({
      code: loaded.code,
      title: loaded.title,
      url: loaded.url,
      startTime: loaded.startTime,
      endTime: loaded.endTime,
      zoneId: loaded.zoneId,
      zoneName: loaded.zoneName,
      fights: loaded.fights.map((fight) => ({
        id: fight.id,
        encounterId: fight.encounterId,
        encounterName: fight.encounterName,
        difficulty: fight.difficulty,
        kill: fight.kill,
        startTime: loaded.startTime + fight.startTime,
        durationMs: Math.max(0, fight.endTime - fight.startTime),
      })),
      killCountsByDifficulty,
      participants: loaded.actors.map((actor) => ({ name: actor.name, className: actor.className })),
      warnings: loaded.friendlyPlayersAvailable ? [] : ['WCL did not return per-fight participants for this report.'],
    })
  })

  reports.sort((left, right) => right.startTime - left.startTime)

  return { reports, warnings, generatedAt: Date.now() }
}

// ---------------------------------------------------------------------------
// Evidence job
// ---------------------------------------------------------------------------

export type RosterEvidenceValidation =
  | { ok: true; normalized: { reportCodes: string[]; difficulty: number | null; encounterIds: number[]; playerNames: string[] } }
  | { ok: false; error: string; hint?: string }

const toTrimmedStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : []

export const validateRosterEvidenceRequest = (body: unknown): RosterEvidenceValidation => {
  const request = (body ?? {}) as Partial<RosterEvidenceRequest>
  const reportCodes = [...new Set(toTrimmedStrings(request.reportCodes))]
  const seenNames = new Set<string>()
  const playerNames = toTrimmedStrings(request.playerNames).filter((name) => {
    const key = name.toLowerCase()
    if (seenNames.has(key)) return false
    seenNames.add(key)
    return true
  })

  if (reportCodes.length === 0) {
    return { ok: false, error: 'At least one report code is required.', hint: 'Select one or more recent raid reports.' }
  }
  if (reportCodes.length > MAX_EVIDENCE_REPORTS) {
    return { ok: false, error: `At most ${MAX_EVIDENCE_REPORTS} reports can be reviewed at once.` }
  }
  if (playerNames.length === 0) {
    return { ok: false, error: 'At least one player name is required.', hint: 'Add available players before building evidence.' }
  }
  if (playerNames.length > MAX_EVIDENCE_PLAYERS) {
    return { ok: false, error: `At most ${MAX_EVIDENCE_PLAYERS} players can be reviewed at once.` }
  }

  let difficulty: number | null = null
  if (request.difficulty !== undefined && request.difficulty !== null) {
    if (!Number.isInteger(request.difficulty) || (request.difficulty as number) <= 0) {
      return { ok: false, error: 'difficulty must be a positive integer when provided.' }
    }
    difficulty = request.difficulty as number
  }

  const encounterIds = Array.isArray(request.encounterIds)
    ? [...new Set(request.encounterIds.filter((id): id is number => Number.isInteger(id) && id > 0))]
    : []

  return { ok: true, normalized: { reportCodes, difficulty, encounterIds, playerNames } }
}

const fetchRankingRows = async (
  config: WclConfig,
  code: string,
  fightIds: number[],
  timeframe: RosterRankingTimeframe
): Promise<Map<number, RosterRankingRow[]>> => {
  const rows = new Map<number, RosterRankingRow[]>()
  const query = timeframe === 'historical' ? RANKINGS_HISTORICAL_QUERY : RANKINGS_CURRENT_QUERY

  const applyRows = (parsedRows: RosterRankingRow[], requested: number[]) => {
    for (const row of parsedRows) {
      // WCL omits fightID in some payload versions; when a single fight was requested we can still attribute it.
      const fightId = row.fightId ?? (requested.length === 1 ? requested[0] : null)
      if (fightId === null) continue
      const list = rows.get(fightId) ?? []
      list.push({ ...row, fightId })
      rows.set(fightId, list)
    }
  }

  for (const group of chunk(fightIds, RANKINGS_CHUNK_SIZE)) {
    const response = await queryWclGraphQl<RankingsQueryResponse>({ config, query, variables: { code, fightIds: group } })
    const parsed = parseRosterRankingsPayload(response.reportData?.report?.rankings, timeframe)
    if (!parsed) continue

    const hasFightIds = parsed.fightIds.some((id) => id !== null)
    if (hasFightIds || group.length === 1) {
      applyRows(parsed.rows, group)
      continue
    }

    // Payload without fight ids for a multi-fight request: fall back to per-fight queries.
    for (const fightId of group) {
      const single = await queryWclGraphQl<RankingsQueryResponse>({ config, query, variables: { code, fightIds: [fightId] } })
      const singleParsed = parseRosterRankingsPayload(single.reportData?.report?.rankings, timeframe)
      if (singleParsed) applyRows(singleParsed.rows, [fightId])
    }
  }

  return rows
}

const runEvidenceJob = async (
  config: WclConfig,
  jobId: string,
  normalized: { reportCodes: string[]; difficulty: number | null; encounterIds: number[]; playerNames: string[] }
): Promise<void> => {
  const { reportCodes, difficulty, encounterIds, playerNames } = normalized
  const warnings: string[] = []
  const reportContexts: RosterReportContext[] = []
  const reportSummaries: RosterEvidenceResult['reports'] = []

  const encounterFilter = new Set(encounterIds)
  const matchesFilter = (fight: RosterReportFightContext): boolean =>
    (difficulty === null || fight.difficulty === difficulty) &&
    (encounterFilter.size === 0 || encounterFilter.has(fight.encounterId))

  try {
    // Step group 1: reports
    RosterJobStore.setStep(jobId, `Loading ${reportCodes.length} report${reportCodes.length === 1 ? '' : 's'}…`)
    const loaded = await Promise.allSettled(reportCodes.map((code) => loadReport(config, code)))
    const loadedReports: LoadedReport[] = []
    loaded.forEach((result, index) => {
      const code = reportCodes[index]
      if (result.status === 'rejected') {
        const classified = classifyWclError(result.reason, { site: resolveSite(config) })
        warnings.push(`Report ${code} could not be loaded: ${classified.message}`)
        RosterJobStore.addWarning(jobId, `Report ${code} could not be loaded.`)
        reportSummaries.push({ code, title: code, url: buildWclReportUrl(resolveSite(config), code), startTime: 0, fightsConsidered: 0, killFightsConsidered: 0, loaded: false })
        RosterJobStore.advance(jobId)
        return
      }
      loadedReports.push(result.value)
      RosterJobStore.advance(jobId)
    })

    const killFightTotal = loadedReports.reduce(
      (sum, report) => sum + report.fights.filter((fight) => fight.kill && matchesFilter(fight)).length,
      0
    )
    // reports + rankings per report + deaths per kill fight + one aggregation step per player
    RosterJobStore.setTotalSteps(jobId, reportCodes.length + loadedReports.length + killFightTotal + playerNames.length)

    // Step group 2: rankings and deaths per report
    for (const report of loadedReports) {
      const fights = report.fights.filter(matchesFilter)
      const killFights = fights.filter((fight) => fight.kill)
      const rankingRowsByFight = new Map<number, RosterRankingRow[]>()
      const deathsByFight = new Map<number, RosterDeathEvent[] | null>()

      if (!report.friendlyPlayersAvailable && fights.length > 0) {
        warnings.push(`Report ${report.code}: WCL did not return per-fight participants; presence falls back to report-level actors.`)
      }

      RosterJobStore.setStep(jobId, `Fetching rankings for ${report.title}…`)
      if (killFights.length > 0) {
        const killFightIds = killFights.map((fight) => fight.id)
        try {
          const historical = await fetchRankingRows(config, report.code, killFightIds, 'historical')
          historical.forEach((rows, fightId) => rankingRowsByFight.set(fightId, rows))
        } catch (error) {
          warnings.push(`Report ${report.code}: historical rankings failed (${asErrorMessage(error)}).`)
        }
        const missing = killFightIds.filter((fightId) => !rankingRowsByFight.has(fightId))
        if (missing.length > 0) {
          try {
            const current = await fetchRankingRows(config, report.code, missing, 'current')
            current.forEach((rows, fightId) => rankingRowsByFight.set(fightId, rows))
          } catch (error) {
            warnings.push(`Report ${report.code}: current rankings failed (${asErrorMessage(error)}).`)
          }
        }
        const stillMissing = killFightIds.filter((fightId) => !rankingRowsByFight.has(fightId))
        if (stillMissing.length > 0) {
          warnings.push(`Report ${report.code}: no rankings returned for ${stillMissing.length} kill fight(s).`)
        }
      }
      RosterJobStore.advance(jobId)

      await runWithConcurrency(killFights, DEATH_FETCH_CONCURRENCY, async (fight) => {
        RosterJobStore.setStep(jobId, `Fetching deaths for ${fight.encounterName} (${report.title})…`)
        const result = await fetchDeathEvents({
          config,
          code: report.code,
          fightId: fight.id,
          startTime: fight.startTime,
          endTime: fight.endTime,
          maxEvents: DEATH_EVENTS_MAX,
        })
        if (result.warnings.length > 0 && result.events.length === 0) {
          deathsByFight.set(fight.id, null)
          warnings.push(`Report ${report.code} fight ${fight.id}: ${result.warnings.join('; ')}`)
        } else {
          deathsByFight.set(
            fight.id,
            result.events
              .filter((event) => typeof event.targetID === 'number' && typeof event.timestamp === 'number')
              .map((event) => ({ targetId: event.targetID as number, timestamp: event.timestamp as number }))
          )
          if (result.truncated) warnings.push(`Report ${report.code} fight ${fight.id}: death events truncated.`)
        }
        RosterJobStore.advance(jobId)
      })

      reportContexts.push({
        code: report.code,
        title: report.title,
        url: report.url,
        startTime: report.startTime,
        actors: report.actors,
        fights,
        rankingRowsByFight,
        deathsByFight,
      })
      reportSummaries.push({
        code: report.code,
        title: report.title,
        url: report.url,
        startTime: report.startTime,
        fightsConsidered: fights.length,
        killFightsConsidered: killFights.length,
        loaded: true,
      })
    }

    if (reportContexts.every((report) => report.fights.length === 0)) {
      warnings.push('No fights matched the selected difficulty/boss filter in the loaded reports.')
    }

    // Step group 3: per-player aggregation (pure)
    const players = playerNames.map((playerName) => {
      RosterJobStore.setStep(jobId, `Building evidence for ${playerName}…`)
      try {
        const evidence = buildPlayerEvidence(playerName, reportContexts)
        RosterJobStore.advance(jobId)
        return evidence
      } catch (error) {
        warnings.push(`Evidence for ${playerName} failed: ${asErrorMessage(error)}`)
        RosterJobStore.advance(jobId)
        return buildPlayerEvidence(playerName, [])
      }
    })

    reportSummaries.sort((left, right) => right.startTime - left.startTime)

    const result: RosterEvidenceResult = {
      reportCodes,
      difficulty,
      encounterIds,
      reports: reportSummaries,
      players,
      warnings,
      generatedAt: Date.now(),
    }

    if (loadedReports.length === 0) {
      RosterJobStore.fail(jobId, 'None of the selected reports could be loaded.', result)
      return
    }
    RosterJobStore.complete(jobId, result, warnings.length > 0 ? 'partial' : 'complete')
  } catch (error) {
    const classified = classifyWclError(error, { site: resolveSite(config) })
    RosterJobStore.fail(jobId, `${classified.message}${classified.hint ? ` ${classified.hint}` : ''}`)
  }
}

export const startRosterEvidenceJob = (
  config: WclConfig,
  normalized: { reportCodes: string[]; difficulty: number | null; encounterIds: number[]; playerNames: string[] }
): RosterEvidenceStartResponse => {
  const jobId = crypto.randomUUID()
  // Provisional total; refined once reports are loaded and kill fights are known.
  RosterJobStore.create(jobId, normalized.reportCodes.length * 2 + normalized.playerNames.length)
  void runEvidenceJob(config, jobId, normalized)
  return { jobId, status: 'queued', statusUrl: `/api/roster-review/evidence/${jobId}` }
}
