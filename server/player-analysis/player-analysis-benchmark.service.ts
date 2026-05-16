import { queryWclGraphQl } from '../warcraft-logs/wcl-client'
import type { WclConfig } from '../warcraft-logs/wcl-config'
import { WclService } from '../warcraft-logs/wcl-service'
import { fetchCombatantInfoEvents } from './player-analysis-event-fetchers'
import type { PlayerBenchmarkCandidate, PlayerBenchmarkCandidatesRequest } from './player-analysis.types'

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
   * Automated benchmark candidate discovery.
   * Currently returns an empty stub — see BENCHMARK_NOTES.md for Phase A findings.
   * Will be implemented once the characterRankings API shape is verified.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async findBenchmarkCandidates(_config: WclConfig, _request: PlayerBenchmarkCandidatesRequest): Promise<{ candidates: PlayerBenchmarkCandidate[]; warnings: string[] }> {
    return {
      candidates: [],
      warnings: [
        'Automated benchmark discovery is not yet implemented — WCL characterRankings API shape requires verification.',
        'Use manual benchmark target: provide reportCode, fightId, and playerName.',
      ],
    }
  },
}
