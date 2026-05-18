import { queryWclGraphQl } from '../warcraft-logs/wcl-client'
import type { WclConfig } from '../warcraft-logs/wcl-config'
import { WclService } from '../warcraft-logs/wcl-service'
import { fetchCombatantInfoEvents } from './player-analysis-event-fetchers'
import type {
  PlayerBenchmarkCandidate,
  BenchmarkBaseline,
  BenchmarkCandidateGroup,
  BenchmarkCandidatesRequest,
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
  context: BaselineContext,
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
  const hasRealName = !!characterName && characterName.toLowerCase() !== 'anonymous'
  const hasUsableExportTarget = hasRealName && hasReportCode && hasFightId && sameClass && sameSpec

  const warnings: string[] = []
  if (!characterName) warnings.push('Ranking entry missing character name.')
  if (characterName && !hasRealName) warnings.push('Ranking entry has a hidden/anonymous name — cannot identify player for export.')
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

function scoreCandidate(c: NormalizedBenchmarkCandidate, context: BaselineContext): number {
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
// Per-baseline candidate discovery helper
// ---------------------------------------------------------------------------

type BaselineContext = {
  playerName: string
  className: string
  specName: string
  encounterId: number
  encounterName?: string
  difficulty: number
  itemLevel?: number
  durationMs?: number
  metric: string
  targetPercentile: 50 | 75 | 90
}

async function findCandidatesForBaseline(
  config: WclConfig,
  baseline: BenchmarkBaseline,
  options: { targetPercentile: 50 | 75 | 90; metric: string; maxCandidates: number }
): Promise<BenchmarkCandidateGroup> {
  const context: BaselineContext = {
    playerName: baseline.playerName,
    className: baseline.className,
    specName: baseline.specName,
    encounterId: baseline.encounterId,
    encounterName: baseline.encounterName,
    difficulty: baseline.difficulty,
    itemLevel: baseline.itemLevel ?? undefined,
    durationMs: baseline.durationMs,
    metric: options.metric,
    targetPercentile: options.targetPercentile,
  }

  let rawResponse: EncounterRankingsQueryResponse
  try {
    rawResponse = await queryWclGraphQl<EncounterRankingsQueryResponse>({
      config,
      query: ENCOUNTER_CHARACTER_RANKINGS_QUERY,
      variables: {
        encounterId: baseline.encounterId,
        className: baseline.className,
        specName: baseline.specName,
        metric: options.metric,
        difficulty: baseline.difficulty,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      baseline,
      candidates: [],
      warnings: [`WCL characterRankings query failed: ${message}`, 'Use manual benchmark mode as a fallback.'],
      apiSupported: false,
    }
  }

  const rawScalar = rawResponse.worldData?.encounter?.characterRankings
  const parsed = parseCharacterRankingsScalar(rawScalar)

  if (!parsed) {
    return {
      baseline,
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

  const allSorted = scored
    .sort((a, b) => {
      const aUsable = a.score !== Infinity ? 0 : 1
      const bUsable = b.score !== Infinity ? 0 : 1
      if (aUsable !== bUsable) return aUsable - bUsable
      return a.score - b.score
    })
    .slice(0, options.maxCandidates)

  const selectedCandidate = allSorted.find((c) => c.validation.hasUsableExportTarget)

  for (const c of allSorted.slice(0, 5)) {
    allWarnings.push(...c.warnings)
  }

  const usableCount = allSorted.filter((c) => c.validation.hasUsableExportTarget).length
  if (usableCount === 0 && allSorted.length > 0) {
    allWarnings.push(
      `Found ${allSorted.length} ranking${allSorted.length > 1 ? 's' : ''} but none have both a report code and fight ID — cannot use for automated export. Use manual benchmark mode.`
    )
  } else if (allSorted.length === 0) {
    allWarnings.push(
      `WCL returned no rankings for ${baseline.className} ${baseline.specName} on encounter ${baseline.encounterId} (difficulty ${baseline.difficulty}).`
    )
  }

  return {
    baseline,
    candidates: allSorted,
    selectedCandidate,
    warnings: allWarnings,
    apiSupported: true,
  }
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
   * Baseline-driven benchmark candidate discovery via WCL characterRankings.
   * Each baseline is a specific player fight — candidates are queried per fight
   * for that exact encounter/difficulty/class/spec.
   */
  async findBenchmarkCandidates(
    config: WclConfig,
    request: BenchmarkCandidatesRequest
  ): Promise<BenchmarkCandidatesResponse> {
    const groups: BenchmarkCandidateGroup[] = []

    for (const baseline of request.baselines) {
      if (!baseline.className || baseline.className === 'unknown' ||
        !baseline.specName || baseline.specName === 'unknown') {
        groups.push({
          baseline,
          candidates: [],
          warnings: [
            `Valid className and specName are required for benchmark discovery. ` +
            `Received "${baseline.className ?? 'none'}"/"${baseline.specName ?? 'none'}" — provide class/spec manually in the benchmark form.`,
          ],
          apiSupported: false,
        })
        continue
      }

      if (typeof baseline.encounterId !== 'number' || baseline.encounterId <= 0) {
        groups.push({
          baseline,
          candidates: [],
          warnings: [`encounterId must be a positive integer (got ${String(baseline.encounterId)}) — this fight cannot be used for benchmark discovery.`],
          apiSupported: false,
        })
        continue
      }

      if (typeof baseline.difficulty !== 'number' || baseline.difficulty <= 0) {
        groups.push({
          baseline,
          candidates: [],
          warnings: [`difficulty must be a positive integer (got ${String(baseline.difficulty)}) — this fight cannot be used for benchmark discovery.`],
          apiSupported: false,
        })
        continue
      }

      const group = await findCandidatesForBaseline(config, baseline, {
        targetPercentile: request.targetPercentile,
        metric: request.metric,
        maxCandidates: request.maxCandidatesPerFight ?? 10,
      })
      groups.push(group)
    }

    return { groups, warnings: [] }
  },
}
