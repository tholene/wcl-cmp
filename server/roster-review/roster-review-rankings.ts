import type {
  RosterOverallPercentileSource,
  RosterRankingRoleBucket,
  RosterRankingTimeframe,
} from './roster-review.types'

/**
 * Parsed row from `report.rankings(fightIDs: [...])`.
 *
 * WCL returns the rankings payload as a JSON scalar. Each `data[]` entry is a
 * fight with `roles.{tanks,healers,dps}.characters[]`. Character rows carry
 * `name`, `class`, `spec`, `amount`, `bracketData` (equipped item level),
 * `rankPercent` (overall percentile), `bracketPercent` (ilvl-bracket percentile),
 * `rank` and `totalParses`. Missing fields stay null; nothing is invented.
 */
export type RosterRankingRow = {
  fightId: number | null
  name: string
  normalizedName: string
  characterId: number | null
  className: string | null
  specName: string | null
  roleBucket: RosterRankingRoleBucket
  overallPercentile: number | null
  overallSource: RosterOverallPercentileSource | null
  bracketPercentile: number | null
  itemLevel: number | null
  amount: number | null
  timeframe: RosterRankingTimeframe
}

export type ParsedRankingsPayload = {
  /** Fight entries in the payload with their fight id (null when WCL omitted it). */
  fightIds: Array<number | null>
  rows: RosterRankingRow[]
}

const ROLE_BUCKETS: RosterRankingRoleBucket[] = ['tanks', 'healers', 'dps']

export const normalizeRosterName = (value: string): string => value.trim().toLowerCase()

const toFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const clampPercent = (value: number): number => Math.max(0, Math.min(100, value))

const readFightId = (entry: Record<string, unknown>): number | null =>
  toFiniteNumber(entry['fightID']) ?? toFiniteNumber(entry['fightId']) ?? null

const deriveOverallFromRank = (row: Record<string, unknown>): number | null => {
  const rankDigits = String(row['rank'] ?? '').replace(/\D/g, '')
  const rank = rankDigits ? Number.parseInt(rankDigits, 10) : null
  const totalParses = toFiniteNumber(row['totalParses'])
  if (rank === null || totalParses === null || totalParses <= 0) return null
  return clampPercent(Math.round((1 - (rank - 1) / totalParses) * 100))
}

const parseCharacterRow = (
  raw: unknown,
  fightId: number | null,
  roleBucket: RosterRankingRoleBucket,
  timeframe: RosterRankingTimeframe
): RosterRankingRow | null => {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const name = toNonEmptyString(row['name'])
  if (!name) return null

  const rankPercent = toFiniteNumber(row['rankPercent'])
  const derived = rankPercent === null ? deriveOverallFromRank(row) : null
  const overallPercentile = rankPercent !== null ? clampPercent(rankPercent) : derived
  const overallSource: RosterOverallPercentileSource | null =
    rankPercent !== null ? 'rankPercent' : derived !== null ? 'derivedFromRank' : null

  const bracketPercent = toFiniteNumber(row['bracketPercent'])
  const bracketData = toFiniteNumber(row['bracketData'])

  return {
    fightId,
    name,
    normalizedName: normalizeRosterName(name),
    characterId: toFiniteNumber(row['id']),
    className: toNonEmptyString(row['class']),
    specName: toNonEmptyString(row['spec']),
    roleBucket,
    overallPercentile,
    overallSource,
    bracketPercentile: bracketPercent !== null ? clampPercent(bracketPercent) : null,
    itemLevel: bracketData !== null ? Math.round(bracketData) : null,
    amount: toFiniteNumber(row['amount']),
    timeframe,
  }
}

export const parseRosterRankingsPayload = (
  raw: unknown,
  timeframe: RosterRankingTimeframe
): ParsedRankingsPayload | null => {
  let parsed: unknown = raw
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!parsed || typeof parsed !== 'object') return null

  const entries = (parsed as { data?: unknown }).data
  if (!Array.isArray(entries)) return null

  const fightIds: Array<number | null> = []
  const rows: RosterRankingRow[] = []

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue
    const fightEntry = entry as Record<string, unknown>
    const fightId = readFightId(fightEntry)
    fightIds.push(fightId)

    const roles = fightEntry['roles']
    if (!roles || typeof roles !== 'object') continue

    for (const bucket of ROLE_BUCKETS) {
      const role = (roles as Record<string, unknown>)[bucket]
      if (!role || typeof role !== 'object') continue
      const characters = (role as { characters?: unknown }).characters
      if (!Array.isArray(characters)) continue
      for (const candidate of characters) {
        const row = parseCharacterRow(candidate, fightId, bucket, timeframe)
        if (row) rows.push(row)
      }
    }
  }

  return { fightIds, rows }
}
