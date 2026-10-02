import { buildCsvFile } from '../player-analysis/player-analysis-csv'
import type { MechanicAuditPlayerMechanicSummary, MechanicAuditPullMechanicSummary, MechanicHit } from './mechanic-audit.types'
import type { PullMechanicRecord } from './mechanic-audit-aggregation'

export const EVENTS_CSV_HEADERS = [
  'raidDate',
  'reportCode',
  'reportTitle',
  'fightId',
  'pullNumber',
  'encounterId',
  'encounterName',
  'difficulty',
  'kill',
  'bossPercentage',
  'fightRelativeTimestampMs',
  'phase',
  'playerId',
  'playerName',
  'playerClass',
  'mechanicKey',
  'mechanicLabel',
  'abilityId',
  'abilityName',
  'amount',
  'absorbed',
  'overkill',
  'diedWithin5Seconds',
  'rawEventCount',
]

export const buildEventsCsv = (hits: MechanicHit[]): string => buildCsvFile(EVENTS_CSV_HEADERS, hits)

export const PLAYER_SUMMARY_CSV_HEADERS = [
  'playerName',
  'playerClass',
  'mechanicKey',
  'mechanicLabel',
  'eligiblePulls',
  'hitPulls',
  'deduplicatedHitOccurrences',
  'hitPullRate',
  'raidNightsPresent',
  'raidNightsWithFailure',
  'last30EligiblePulls',
  'last30HitPulls',
  'last30HitPullRate',
  'guildAverageHitPullRate',
  'playerRateMinusGuildAverage',
  'playerRateDividedByGuildAverage',
  'reviewCandidate',
]

export const buildPlayerSummaryCsv = (summaries: MechanicAuditPlayerMechanicSummary[]): string =>
  buildCsvFile(PLAYER_SUMMARY_CSV_HEADERS, summaries)

export const PULL_SUMMARY_CSV_HEADERS = [
  'raidDate',
  'reportCode',
  'fightId',
  'pullNumber',
  'kill',
  'bossPercentage',
  'fightDurationMs',
  'phaseOneEndMs',
  'phaseBoundarySource',
  'mechanicKey',
  'mechanicLabel',
  'mechanicOccurred',
  'mechanicOccurrenceQuality',
  'eligiblePlayerCount',
  'uniquePlayersHit',
  'deduplicatedHitOccurrences',
  'firstHitTimestampMs',
  'playersHit',
  'isDuplicate',
  'duplicateGroupId',
  'canonicalReportCode',
]

export const toPullSummaryRow = (record: PullMechanicRecord): MechanicAuditPullMechanicSummary => ({
  raidDate: record.raidDate,
  reportCode: record.reportCode,
  fightId: record.fightId,
  pullNumber: record.pullNumber,
  kill: record.kill,
  bossPercentage: record.bossPercentage ?? null,
  fightDurationMs: record.fightDurationMs,
  phaseOneEndMs: record.phaseOneEndMs,
  phaseBoundarySource: record.phaseBoundarySource,
  mechanicKey: record.mechanicKey,
  mechanicLabel: record.mechanicLabel,
  mechanicOccurred: record.mechanicOccurred,
  mechanicOccurrenceQuality: record.mechanicOccurrenceQuality,
  eligiblePlayerCount: record.eligiblePlayers.length,
  uniquePlayersHit: record.hitPlayers.length,
  deduplicatedHitOccurrences: record.dedupedOccurrences.length,
  firstHitTimestampMs: record.firstHitFightRelativeMs,
  playersHit: record.hitPlayers.map((p) => p.playerName),
  isDuplicate: record.isDuplicate,
  duplicateGroupId: record.duplicateGroupId,
  canonicalReportCode: record.canonicalReportCode,
})

export const buildPullSummaryCsv = (records: PullMechanicRecord[]): string =>
  buildCsvFile(
    PULL_SUMMARY_CSV_HEADERS,
    records.map((record) => {
      const row = toPullSummaryRow(record)
      return { ...row, playersHit: row.playersHit.join('; ') }
    })
  )
