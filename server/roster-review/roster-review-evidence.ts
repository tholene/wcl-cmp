import type { RosterRankingRow } from './roster-review-rankings'
import { normalizeRosterName } from './roster-review-rankings'
import type {
  RosterEvidenceSignal,
  RosterFightEvidence,
  RosterFightRanking,
  RosterItemLevelStats,
  RosterOutputStats,
  RosterOverallPercentileSource,
  RosterPercentileStats,
  RosterPlayerConsistency,
  RosterPlayerEvidence,
  RosterPlayerExecution,
  RosterPlayerPerformance,
} from './roster-review.types'

// ---------------------------------------------------------------------------
// Input contexts (built by the service from WCL responses)
// ---------------------------------------------------------------------------

export type RosterReportActor = {
  id: number
  name: string
  className: string | null
}

export type RosterReportFightContext = {
  id: number
  encounterId: number
  encounterName: string
  difficulty: number
  kill: boolean
  /** Report-relative ms. */
  startTime: number
  /** Report-relative ms. */
  endTime: number
  /** Actor ids present in the fight, null when WCL did not provide them. */
  friendlyPlayers: number[] | null
}

export type RosterDeathEvent = {
  targetId: number
  /** Report-relative ms. */
  timestamp: number
}

export type RosterReportContext = {
  code: string
  title: string
  url: string
  startTime: number
  actors: RosterReportActor[]
  /** Fights that passed the difficulty/encounter filter. */
  fights: RosterReportFightContext[]
  rankingRowsByFight: Map<number, RosterRankingRow[]>
  /** Deaths per kill fight. Missing key or null value = unknown. */
  deathsByFight: Map<number, RosterDeathEvent[] | null>
}

// ---------------------------------------------------------------------------
// Numeric helpers
// ---------------------------------------------------------------------------

export const median = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

export const mean = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length

const round1 = (value: number | null): number | null =>
  value === null ? null : Math.round(value * 10) / 10

const percentileStats = (orderedNewestFirst: number[]): RosterPercentileStats | null => {
  if (orderedNewestFirst.length === 0) return null
  return {
    latest: orderedNewestFirst[0],
    median: round1(median(orderedNewestFirst)),
    mean: round1(mean(orderedNewestFirst)),
    best: Math.max(...orderedNewestFirst),
    worst: Math.min(...orderedNewestFirst),
  }
}

// ---------------------------------------------------------------------------
// Fight-level evidence
// ---------------------------------------------------------------------------

const findActor = (report: RosterReportContext, playerName: string): RosterReportActor | null => {
  const normalized = normalizeRosterName(playerName)
  return report.actors.find((actor) => normalizeRosterName(actor.name) === normalized) ?? null
}

const findRankingRow = (
  rows: RosterRankingRow[] | undefined,
  playerName: string
): RosterRankingRow | null => {
  if (!rows) return null
  const normalized = normalizeRosterName(playerName)
  return rows.find((row) => row.normalizedName === normalized) ?? null
}

const toFightRanking = (row: RosterRankingRow): RosterFightRanking => ({
  overallPercentile: row.overallPercentile,
  overallSource: row.overallSource,
  bracketPercentile: row.bracketPercentile,
  itemLevel: row.itemLevel,
  amount: row.amount,
  roleBucket: row.roleBucket,
  className: row.className,
  specName: row.specName,
  timeframe: row.timeframe,
})

const buildFightEvidence = (
  report: RosterReportContext,
  fight: RosterReportFightContext,
  actor: RosterReportActor | null,
  playerName: string
): RosterFightEvidence => {
  const rankingRow = fight.kill ? findRankingRow(report.rankingRowsByFight.get(fight.id), playerName) : null

  let present: boolean | null
  let presenceSource: RosterFightEvidence['presenceSource']
  if (actor && fight.friendlyPlayers) {
    present = fight.friendlyPlayers.includes(actor.id)
    presenceSource = 'fightFriendlyPlayers'
  } else if (rankingRow) {
    present = true
    presenceSource = 'reportActors'
  } else if (!actor) {
    present = false
    presenceSource = 'reportActors'
  } else {
    present = null
    presenceSource = 'unknown'
  }

  let deaths: RosterFightEvidence['deaths'] = null
  if (fight.kill && actor && present) {
    const fightDeaths = report.deathsByFight.get(fight.id)
    if (fightDeaths) {
      const times = fightDeaths
        .filter((event) => event.targetId === actor.id)
        .map((event) => Math.max(0, event.timestamp - fight.startTime))
        .sort((a, b) => a - b)
      deaths = { count: times.length, timesMs: times }
    }
  }

  return {
    reportCode: report.code,
    fightId: fight.id,
    encounterId: fight.encounterId,
    encounterName: fight.encounterName,
    difficulty: fight.difficulty,
    kill: fight.kill,
    startTime: report.startTime + fight.startTime,
    durationMs: Math.max(0, fight.endTime - fight.startTime),
    present,
    presenceSource,
    ranking: rankingRow ? toFightRanking(rankingRow) : null,
    deaths,
  }
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

const mostFrequent = (values: string[]): string | null => {
  if (values.length === 0) return null
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

const roleFromBucket = (bucket: string | null): RosterPlayerEvidence['wclRole'] => {
  if (bucket === 'tanks') return 'tank'
  if (bucket === 'healers') return 'healer'
  if (bucket === 'dps') return 'dps'
  return 'unknown'
}

const buildPerformance = (rankedFights: RosterFightEvidence[]): RosterPlayerPerformance => {
  const rankings = rankedFights.map((fight) => fight.ranking).filter((r): r is RosterFightRanking => r !== null)
  const overallValues = rankings.map((r) => r.overallPercentile).filter((v): v is number => v !== null)
  const bracketValues = rankings.map((r) => r.bracketPercentile).filter((v): v is number => v !== null)
  const ilvlValues = rankings.map((r) => r.itemLevel).filter((v): v is number => v !== null)
  const amounts = rankings.map((r) => r.amount).filter((v): v is number => v !== null)

  const overallSources: Record<RosterOverallPercentileSource, number> = { rankPercent: 0, derivedFromRank: 0 }
  for (const ranking of rankings) {
    if (ranking.overallSource) overallSources[ranking.overallSource] += 1
  }

  const itemLevel: RosterItemLevelStats | null =
    ilvlValues.length === 0
      ? null
      : { latest: ilvlValues[0], min: Math.min(...ilvlValues), max: Math.max(...ilvlValues) }

  const bucket = mostFrequent(rankings.map((r) => r.roleBucket))
  const output: RosterOutputStats | null =
    amounts.length === 0
      ? null
      : {
          latestAmount: Math.round(amounts[0]),
          meanAmount: Math.round(mean(amounts) ?? 0),
          metric: bucket === 'healers' ? 'hps' : bucket === 'dps' || bucket === 'tanks' ? 'dps' : 'unknown',
        }

  return {
    sampleSize: rankings.length,
    overall: percentileStats(overallValues),
    bracket: percentileStats(bracketValues),
    itemLevel,
    output,
    overallSources,
  }
}

const buildConsistency = (performance: RosterPlayerPerformance, overallValues: number[]): RosterPlayerConsistency => {
  const overall = performance.overall
  return {
    spread: overall && overall.best !== null && overall.worst !== null ? overall.best - overall.worst : null,
    bestMinusMedian:
      overall && overall.best !== null && overall.median !== null ? round1(overall.best - overall.median) : null,
    belowFiftyCount: overallValues.filter((value) => value < 50).length,
    atLeastSeventyFiveCount: overallValues.filter((value) => value >= 75).length,
  }
}

const buildExecution = (fights: RosterFightEvidence[]): RosterPlayerExecution => {
  const presentKillFights = fights.filter((fight) => fight.kill && fight.present === true)
  const checked = presentKillFights.filter((fight) => fight.deaths !== null)
  const deaths = checked.reduce((sum, fight) => sum + (fight.deaths?.count ?? 0), 0)
  const fightsWithDeath = checked.filter((fight) => (fight.deaths?.count ?? 0) > 0).length
  const deathPercents = checked.flatMap((fight) =>
    fight.durationMs > 0 ? (fight.deaths?.timesMs ?? []).map((t) => (t / fight.durationMs) * 100) : []
  )
  return {
    killFightsChecked: checked.length,
    killFightsDeathUnknown: presentKillFights.length - checked.length,
    deaths,
    fightsWithDeath,
    earliestDeathPercentOfFight: deathPercents.length > 0 ? Math.round(Math.min(...deathPercents)) : null,
  }
}

const buildSignals = (evidence: Omit<RosterPlayerEvidence, 'signals'>): RosterEvidenceSignal[] => {
  const signals: RosterEvidenceSignal[] = []
  const { performance, consistency, execution, logPresence, fightPresence } = evidence

  if (evidence.status === 'notFound') {
    signals.push({
      code: 'notFoundInLogs',
      severity: 'caution',
      label: 'Not in selected logs',
      detail: 'No player with this name appears in any selected report. This is not evidence of an unexcused absence.',
    })
    return signals
  }

  if (performance.sampleSize === 0) {
    signals.push({
      code: 'noRankingData',
      severity: 'caution',
      label: 'No ranking data',
      detail: 'No kill fight returned a WCL ranking row for this player (hidden character, no kills, or rankings unavailable).',
    })
  } else if (performance.sampleSize < 3) {
    signals.push({
      code: 'limitedSample',
      severity: 'caution',
      label: 'Limited sample',
      detail: `Only ${performance.sampleSize} ranked kill${performance.sampleSize === 1 ? '' : 's'} in the window. Treat averages with care.`,
    })
  }

  if (performance.overallSources.derivedFromRank > 0) {
    signals.push({
      code: 'derivedPercentile',
      severity: 'info',
      label: 'Derived percentile',
      detail: `${performance.overallSources.derivedFromRank} overall percentile(s) were derived from rank/total parses because WCL omitted rankPercent.`,
    })
  }

  if (consistency.bestMinusMedian !== null && consistency.bestMinusMedian >= 15 && performance.sampleSize >= 3) {
    signals.push({
      code: 'bestOutlier',
      severity: 'info',
      label: 'Best above typical',
      detail: `Best overall parse is ${consistency.bestMinusMedian} points above the median. Do not let one kill carry the case.`,
    })
  }

  if (consistency.spread !== null && consistency.spread >= 30 && performance.sampleSize >= 3) {
    signals.push({
      code: 'highSpread',
      severity: 'info',
      label: 'Wide spread',
      detail: `Overall parses range across ${consistency.spread} points between worst and best kills.`,
    })
  }

  if (evidence.specsSeen.length > 1) {
    signals.push({
      code: 'multipleSpecs',
      severity: 'info',
      label: 'Multiple specs',
      detail: `Ranked as ${evidence.specsSeen.join(' and ')} in the window. Percentiles are spec-relative.`,
    })
  }

  const overall = performance.overall?.median ?? null
  const bracket = performance.bracket?.median ?? null
  if (overall !== null && bracket !== null) {
    if (bracket - overall >= 20) {
      signals.push({
        code: 'bracketAboveOverall',
        severity: 'info',
        label: 'Efficient for gear',
        detail: `Ilvl-bracket median (${bracket}) is well above overall median (${overall}): strong relative to similarly geared players, but absolute output is lower than the spec field.`,
      })
    } else if (overall - bracket >= 20) {
      signals.push({
        code: 'overallAboveBracket',
        severity: 'info',
        label: 'Gear-supported output',
        detail: `Overall median (${overall}) is well above ilvl-bracket median (${bracket}): output is strong, partly carried by gear relative to similarly geared players.`,
      })
    }
  }

  if (logPresence.reportsTotal > 0 && logPresence.reportsPresent < logPresence.reportsTotal) {
    signals.push({
      code: 'missingFromLogs',
      severity: 'info',
      label: 'Missing from some logs',
      detail: `Logged in ${logPresence.reportsPresent} of ${logPresence.reportsTotal} selected reports. Absence from a log is not proof of an unexcused absence.`,
    })
  }

  if (fightPresence.satOutKillFights > 0) {
    signals.push({
      code: 'satOutFights',
      severity: 'info',
      label: 'Sat out kill fights',
      detail: `Logged in the raid but not in ${fightPresence.satOutKillFights} kill fight(s).`,
    })
  }

  if (execution.fightsWithDeath >= 2) {
    signals.push({
      code: 'repeatedDeaths',
      severity: 'caution',
      label: 'Repeated deaths',
      detail: `Died in ${execution.fightsWithDeath} of ${execution.killFightsChecked} checked kill fights (${execution.deaths} deaths). Review the fights before drawing conclusions.`,
    })
  }

  return signals
}

export const buildPlayerEvidence = (playerName: string, reports: RosterReportContext[]): RosterPlayerEvidence => {
  const fights: RosterFightEvidence[] = []
  const presentReportCodes: string[] = []
  const absentReportCodes: string[] = []
  const warnings: string[] = []
  let resolvedName: string | null = null
  let className: string | null = null
  let satOutKillFights = 0

  for (const report of reports) {
    const actor = findActor(report, playerName)
    if (actor) {
      presentReportCodes.push(report.code)
      resolvedName = resolvedName ?? actor.name
      className = className ?? actor.className
    } else {
      absentReportCodes.push(report.code)
    }

    for (const fight of report.fights) {
      const fightEvidence = buildFightEvidence(report, fight, actor, playerName)
      fights.push(fightEvidence)
      if (actor && fight.kill && fightEvidence.present === false) satOutKillFights += 1
    }
  }

  fights.sort((a, b) => b.startTime - a.startTime)

  const rankedFights = fights.filter((fight) => fight.kill && fight.ranking !== null)
  const performance = buildPerformance(rankedFights)
  const overallValues = rankedFights
    .map((fight) => fight.ranking?.overallPercentile ?? null)
    .filter((v): v is number => v !== null)
  const consistency = buildConsistency(performance, overallValues)
  const execution = buildExecution(fights)

  const rankingClass = rankedFights.map((f) => f.ranking?.className ?? null).find((c) => c !== null) ?? null
  const specsSeen = [...new Set(rankedFights.map((f) => f.ranking?.specName ?? null).filter((s): s is string => s !== null))]
  const primarySpecName = mostFrequent(rankedFights.map((f) => f.ranking?.specName ?? null).filter((s): s is string => s !== null))
  const wclRole = roleFromBucket(mostFrequent(rankedFights.map((f) => f.ranking?.roleBucket ?? 'unknown')))

  const fightsPresent = fights.filter((f) => f.present === true).length
  const fightsUnknown = fights.filter((f) => f.present === null).length

  const status: RosterPlayerEvidence['status'] =
    presentReportCodes.length === 0 ? 'notFound' : performance.sampleSize === 0 || execution.killFightsDeathUnknown > 0 ? 'partial' : 'ok'

  if (status === 'notFound') {
    warnings.push(`${playerName} was not found in any selected report.`)
  }
  if (presentReportCodes.length > 0 && performance.sampleSize === 0) {
    warnings.push(`${playerName} has no ranking rows in the selected kill fights.`)
  }
  if (execution.killFightsDeathUnknown > 0) {
    warnings.push(`Death data unavailable for ${execution.killFightsDeathUnknown} kill fight(s).`)
  }
  if (fightsUnknown > 0) {
    warnings.push(`Fight presence unknown for ${fightsUnknown} fight(s) (WCL did not return fight participants).`)
  }

  const base: Omit<RosterPlayerEvidence, 'signals'> = {
    playerName,
    resolvedName,
    className: rankingClass ?? className,
    primarySpecName,
    specsSeen,
    wclRole,
    status,
    logPresence: {
      reportsPresent: presentReportCodes.length,
      reportsTotal: reports.length,
      presentReportCodes,
      absentReportCodes,
    },
    fightPresence: {
      fightsPresent,
      fightsTotal: fights.length,
      fightsUnknown,
      satOutKillFights,
    },
    performance,
    consistency,
    execution,
    fights,
    warnings,
  }

  return { ...base, signals: buildSignals(base) }
}
