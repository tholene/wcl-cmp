import { queryWclGraphQl } from '../warcraft-logs/wcl-client'
import type { WclConfig } from '../warcraft-logs/wcl-config'
import { WclService } from '../warcraft-logs/wcl-service'
import { fetchCombatantInfoEvents } from './player-analysis-event-fetchers'
import type {
  PlayerBenchmarkCandidate,
  PlayerBenchmarkCandidatesRequest,
  BenchmarkSubjectContext,
  NormalizedBenchmarkCandidate,
  BenchmarkCandidatesResponse,
} from './player-analysis.types'

// ---------------------------------------------------------------------------
// Manual benchmark queries
// ---------------------------------------------------------------------------

type ReportPlayersQueryResponse = {
  reportData?: {
    report?: {
      masterData?: {
        actors?: Array<{
          id: number
          name?: string | null
          type?: string | null
          subType?: string | null
        }>
      } | null
    } | null
  }
}

const REPORT_PLAYERS_QUERY = `
  query ReportPlayers($code: String!) {
    reportData {
      report(code: $code) {
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

// ---------------------------------------------------------------------------
// Automated discovery query
// ---------------------------------------------------------------------------

type EncounterRankingsQueryResponse = {
  worldData?: {
    encounter?: {
      characterRankings?: unknown
    } | null
  }
}

const ENCOUNTER_CHARACTER_RANKINGS_QUERY = `
  query EncounterCharacterRankings(
    $encounterId: Int!
    $className: String!
    $specName: String!
    $metric: CharacterRankingMetricType!
    $difficulty: Int!
  ) {
    worldData {
      encounter(id: $encounterId) {
        characterRankings(
          className: $className
          specName: $specName
          metric: $metric
          difficulty: $difficulty
          page: 1
        )
      }
    }
  }
`

// ---------------------------------------------------------------------------
// Opaque scalar helpers
// ---------------------------------------------------------------------------

function parseCharacterRankingsScalar(raw: unknown): { rankings: unknown[]; count: number } | null {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!parsed || typeof parsed !== 'object') return null
  const obj = parsed as Record<string, unknown>
  if (!Array.isArray(obj['rankings'])) return null
  return {
    rankings: obj['rankings'] as unknown[],
    count: typeof obj['count'] === 'number' ? obj['count'] : 0,
  }
}

function normalizeRankingEntry(
  raw: unknown,
  context: BenchmarkSubjectContext,
  totalCount: number
): NormalizedBenchmarkCandidate {
  const entry = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const report =
    entry['report'] && typeof entry['report'] === 'object'
      ? (entry['report'] as Record<string, unknown>)
      : {}

  const characterName = typeof entry['name'] === 'string' ? entry['name'] : ''
  // WCL ranking responses use 'class'/'spec' (short forms)
  const className =
    typeof entry['class'] === 'string'
      ? entry['class']
      : typeof entry['className'] === 'string'
        ? entry['className']
        : undefined
  const specName =
    typeof entry['spec'] === 'string'
      ? entry['spec']
      : typeof entry['specName'] === 'string'
        ? entry['specName']
        : undefined
  // WCL uses 'fightID' (capital D) in some contexts — check both
  const reportCode = typeof report['code'] === 'string' ? report['code'] : undefined
  const fightId =
    typeof report['fightID'] === 'number'
      ? report['fightID']
      : typeof report['fightId'] === 'number'
        ? report['fightId']
        : undefined
  const itemLevel =
    typeof entry['itemLevel'] === 'number'
      ? entry['itemLevel']
      : typeof entry['bracketData'] === 'number'
        ? Math.round(entry['bracketData'] as number)
        : undefined
  const durationMs = typeof entry['duration'] === 'number' ? entry['duration'] : undefined
  const amount = typeof entry['amount'] === 'number' ? entry['amount'] : undefined
  const rank = typeof entry['rank'] === 'number' ? entry['rank'] : undefined
  const reportStartTime = typeof report['startTime'] === 'number' ? report['startTime'] : undefined

  // WCL may omit percentile field — derive from rank + count if needed
  let percentile = typeof entry['percentile'] === 'number' ? entry['percentile'] : undefined
  if (percentile === undefined && rank !== undefined && totalCount > 0) {
    percentile = Math.round((1 - (rank - 1) / totalCount) * 100)
  }

  const serverRaw = entry['server']
  const serverName =
    typeof serverRaw === 'string'
      ? serverRaw
      : serverRaw && typeof serverRaw === 'object'
        ? ((serverRaw as Record<string, unknown>)['name'] as string | undefined)
        : undefined
  const region = typeof entry['region'] === 'string' ? entry['region'] : undefined

  const sameClass = !!className && className.toLowerCase() === context.className.toLowerCase()
  const sameSpec = !!specName && specName.toLowerCase() === context.specName.toLowerCase()
  const hasReportCode = !!reportCode
  const hasFightId = typeof fightId === 'number'
  const hasUsableExportTarget = hasReportCode && hasFightId && sameClass && sameSpec

  const warnings: string[] = []
  if (!characterName) warnings.push('Ranking entry missing character name.')
  if (!className) warnings.push('Ranking entry missing class — same-class validation skipped.')
  if (!specName) warnings.push('Ranking entry missing spec — same-spec validation skipped.')
  if (!hasReportCode) warnings.push('Ranking entry missing report code — cannot use for export.')
  if (!hasFightId) warnings.push('Ranking entry missing fight ID — cannot use for export.')

  return {
    source: 'wclRankings',
    characterName,
    className,
    specName,
    serverName,
    region,
    encounterId: context.encounterId,
    encounterName: context.encounterName,
    difficulty: context.difficulty,
    reportCode,
    fightId,
    percentile,
    rank,
    metric: context.metric,
    amount,
    itemLevel,
    durationMs,
    reportStartTime,
    reportUrl:
      reportCode && hasFightId
        ? `https://www.warcraftlogs.com/reports/${reportCode}#fight=${fightId}`
        : undefined,
    validation: {
      sameEncounter: true,
      sameDifficulty: true,
      sameClass,
      sameSpec,
      hasReportCode,
      hasFightId,
      hasUsableExportTarget,
    },
    score: 0,
    warnings,
  }
}

function scoreCandidate(c: NormalizedBenchmarkCandidate, context: BenchmarkSubjectContext): number {
  if (!c.validation.hasUsableExportTarget) return Infinity

  const percentileDistance =
    c.percentile !== undefined ? Math.abs(c.percentile - context.targetPercentile) * 3 : 30
  const itemLevelDelta =
    c.itemLevel !== undefined && context.itemLevel !== undefined
      ? Math.abs(c.itemLevel - context.itemLevel) * 2
      : 10
  const durationDeltaPct =
    c.durationMs !== undefined && context.durationMs !== undefined && context.durationMs > 0
      ? (Math.abs(c.durationMs - context.durationMs) / context.durationMs) * 100
      : 10

  return percentileDistance + itemLevelDelta + durationDeltaPct
}

// ---------------------------------------------------------------------------
// Shared types for manual benchmark result
// ---------------------------------------------------------------------------

export type ManualBenchmarkFight = {
  fightId: number
  encounterId: number
  encounterName: string
  difficulty: number
  kill: boolean
  durationMs: number
  startTime: number
}

export type ManualBenchmarkResult = {
  candidate: PlayerBenchmarkCandidate | null
  fight: ManualBenchmarkFight | null
  sourceId: number | null
  warnings: string[]
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const PlayerAnalysisBenchmarkService = {
  /**
   * Fetch data for a manually specified benchmark target.
   * Verifies class/spec against the player's known class.
   * Always warns if same class/spec cannot be confirmed.
   */
  async fetchManualBenchmarkTarget(
    config: WclConfig,
    target: { reportCode: string; fightId: number; playerName: string; sourceId?: number },
    playerClassName: string | null
  ): Promise<ManualBenchmarkResult> {
    const warnings: string[] = []

    let reportDetails
    try {
      reportDetails = await WclService.getReportDetails(config, target.reportCode)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { candidate: null, fight: null, sourceId: null, warnings: [`Could not load benchmark report ${target.reportCode}: ${message}`] }
    }

    const fight = reportDetails.fights.find((f) => f.id === target.fightId)
    if (!fight) {
      return { candidate: null, fight: null, sourceId: null, warnings: [`Fight ${target.fightId} not found in benchmark report ${target.reportCode}`] }
    }

    // Find benchmark player actor
    let actorId: number | null = target.sourceId ?? null
    let benchClassName: string | null = null

    try {
      const response = await queryWclGraphQl<ReportPlayersQueryResponse>({
        config,
        query: REPORT_PLAYERS_QUERY,
        variables: { code: target.reportCode },
      })
      const actors = response.reportData?.report?.masterData?.actors ?? []
      const match = actors.find(
        (a) => a.type === 'Player' && a.name?.toLowerCase() === target.playerName.toLowerCase()
      )
      if (match) {
        actorId = actorId ?? match.id
        benchClassName = match.subType ?? null
      }
    } catch {
      warnings.push(`Could not load actor data for benchmark report ${target.reportCode}`)
    }

    if (!actorId) {
      warnings.push(`Could not find player ${target.playerName} in benchmark report ${target.reportCode}`)
      return { candidate: null, fight: null, sourceId: null, warnings }
    }

    // Try to get spec from CombatantInfo
    let benchSpecName: string | null = null
    try {
      const combatantResult = await fetchCombatantInfoEvents({
        config,
        code: target.reportCode,
        fightId: target.fightId,
        startTime: fight.startTime,
        endTime: fight.endTime,
        maxEvents: 50,
      })
      const combatantEvent = combatantResult.events.find((e) => e.sourceID === actorId)
      if (combatantEvent?.specID) {
        // specID → name mapping requires game data; mark unknown for now
        benchSpecName = null
      }
    } catch {
      // Non-fatal
    }

    // Class/spec verification
    const sameClass =
      benchClassName !== null && playerClassName !== null
        ? benchClassName.toLowerCase() === playerClassName.toLowerCase()
        : false

    if (!benchClassName || !playerClassName) {
      warnings.push('Benchmark class could not be verified — class data unavailable from WCL actor data.')
    } else if (!sameClass) {
      warnings.push(
        `Benchmark class mismatch: player is ${playerClassName}, benchmark is ${benchClassName}. Benchmark spec could not be verified; do not use this for play-correction conclusions.`
      )
    } else {
      warnings.push('Benchmark spec could not be verified (spec detection from WCL requires additional game data mapping); treat with caution.')
    }

    const durationMs = Math.max(fight.endTime - fight.startTime, 0)

    const candidate: PlayerBenchmarkCandidate = {
      reportCode: target.reportCode,
      fightId: target.fightId,
      encounterId: fight.encounterId,
      encounterName: fight.encounterName,
      difficulty: fight.difficulty,
      playerName: target.playerName,
      className: benchClassName ?? 'unknown',
      specName: benchSpecName ?? 'unknown',
      durationMs,
      reportUrl: `https://www.warcraftlogs.com/reports/${target.reportCode}#fight=${target.fightId}`,
      matchedBy: {
        sameEncounter: true,
        sameDifficulty: true,
        sameClass,
        sameSpec: false, // spec cannot be auto-verified
      },
      warnings,
    }

    const fightInfo: ManualBenchmarkFight = {
      fightId: fight.id,
      encounterId: fight.encounterId,
      encounterName: fight.encounterName,
      difficulty: fight.difficulty,
      kill: fight.kill,
      durationMs,
      startTime: fight.startTime,
    }

    return { candidate, fight: fightInfo, sourceId: actorId, warnings }
  },

  /**
   * Automated benchmark candidate discovery via WCL characterRankings.
   * Queries encounter rankings filtered by class/spec/metric/difficulty.
   * Returns normalized, scored candidates. Returns apiSupported: false if the
   * WCL API cannot fulfil the request (wrong shape, missing fields, API error).
   */
  async findBenchmarkCandidates(
    config: WclConfig,
    request: PlayerBenchmarkCandidatesRequest
  ): Promise<BenchmarkCandidatesResponse> {
    const context: BenchmarkSubjectContext = {
      playerName: request.playerName,
      className: request.className,
      specName: request.specName,
      encounterId: request.encounterId,
      encounterName: request.encounterName,
      difficulty: request.difficulty,
      itemLevel: request.itemLevel ?? undefined,
      durationMs: request.durationMs,
      metric: request.metric,
      targetPercentile: request.targetPercentile,
    }

    let rawResponse: EncounterRankingsQueryResponse
    try {
      rawResponse = await queryWclGraphQl<EncounterRankingsQueryResponse>({
        config,
        query: ENCOUNTER_CHARACTER_RANKINGS_QUERY,
        variables: {
          encounterId: request.encounterId,
          className: request.className,
          specName: request.specName,
          metric: request.metric,
          difficulty: request.difficulty,
        },
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        candidates: [],
        warnings: [`WCL characterRankings query failed: ${message}`, 'Use manual benchmark mode as a fallback.'],
        apiSupported: false,
      }
    }

    const rawScalar = rawResponse.worldData?.encounter?.characterRankings
    const parsed = parseCharacterRankingsScalar(rawScalar)

    if (!parsed) {
      return {
        candidates: [],
        warnings: [
          'WCL characterRankings returned an unexpected response shape — automated discovery cannot proceed.',
          'Use manual benchmark mode as a fallback.',
        ],
        apiSupported: false,
      }
    }

    const { rankings, count } = parsed
    const allWarnings: string[] = []

    const normalized = rankings.map((entry) => normalizeRankingEntry(entry, context, count))

    const scored = normalized.map((c) => ({ ...c, score: scoreCandidate(c, context) }))

    const usable = scored
      .filter((c) => c.score !== Infinity)
      .sort((a, b) => a.score - b.score)
      .slice(0, request.maxCandidates ?? 10)

    // Collect candidate-level warnings for the first few entries
    for (const c of scored.slice(0, 5)) {
      allWarnings.push(...c.warnings)
    }

    if (usable.length === 0 && normalized.length > 0) {
      allWarnings.push(
        `Found ${normalized.length} rankings but none matched class=${request.className} spec=${request.specName} with a usable report code and fight ID.`
      )
    }

    return {
      candidates: usable,
      selectedCandidate: usable[0],
      warnings: allWarnings,
      apiSupported: true,
    }
  },
}
