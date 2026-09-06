import type {
  RosterAvailabilityEntry,
  RosterDecisionEntry,
  RosterPlayerEvidence,
  RosterRaidRole,
  RosterRoleTargets,
} from '../types/roster-review.types'

/**
 * Transparent heuristic grouping. These tags help officers see where to look;
 * they never decide the roster and there is deliberately no combined score.
 */
export type RosterEvidenceTag =
  | 'strongEvidence'
  | 'boundary'
  | 'limitedEvidence'
  | 'reliabilityNote'
  | 'availabilityNote'
  | 'gearNote'

export const EVIDENCE_TAG_LABELS: Record<RosterEvidenceTag, string> = {
  strongEvidence: 'Strong recent evidence',
  boundary: 'Near role boundary',
  limitedEvidence: 'Limited evidence',
  reliabilityNote: 'Log presence note',
  availabilityNote: 'Availability note',
  gearNote: 'Gear note',
}

export const EVIDENCE_TAG_EXPLANATIONS: Record<RosterEvidenceTag, string> = {
  strongEvidence: 'Median overall parse ≥ 75 across at least 3 ranked kills.',
  boundary: 'Sits within two places of the role target when ordered by median overall parse.',
  limitedEvidence: 'Fewer than 3 ranked kills or no ranking data in the window.',
  reliabilityNote: 'Missing from at least one selected log or sat out kill fights. Not proof of an unexcused absence.',
  availabilityNote: 'Marked late or absent for the target raid.',
  gearNote: 'Item level is 10+ below the median of players in the same raid role.',
}

export type RosterReviewRow = {
  entry: RosterAvailabilityEntry
  evidence: RosterPlayerEvidence | null
  decision: RosterDecisionEntry | null
  tags: RosterEvidenceTag[]
  /** Position (1-based) within the raid role when ordered by median overall parse; null without evidence. */
  roleRank: number | null
  roleTarget: number | null
}

const medianOf = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

const targetForRole = (role: RosterRaidRole, targets: RosterRoleTargets): number | null => {
  if (role === 'tank') return targets.tanks
  if (role === 'healer') return targets.healers
  if (role === 'melee' || role === 'ranged') return targets.dps
  return null
}

const groupRoleKey = (role: RosterRaidRole): string => (role === 'melee' || role === 'ranged' ? 'dps' : role)

export const buildRosterReviewRows = (
  availability: RosterAvailabilityEntry[],
  evidenceByName: Map<string, RosterPlayerEvidence>,
  decisions: Record<string, RosterDecisionEntry>,
  targets: RosterRoleTargets
): RosterReviewRow[] => {
  const rows: RosterReviewRow[] = availability.map((entry) => ({
    entry,
    evidence: evidenceByName.get(entry.playerName.toLowerCase()) ?? null,
    decision: decisions[entry.playerName] ?? null,
    tags: [],
    roleRank: null,
    roleTarget: targetForRole(entry.role, targets),
  }))

  // Rank within role group (tank / healer / dps) by median overall parse.
  const groups = new Map<string, RosterReviewRow[]>()
  for (const row of rows) {
    const key = groupRoleKey(row.entry.role)
    const list = groups.get(key) ?? []
    list.push(row)
    groups.set(key, list)
  }

  for (const [key, group] of groups) {
    const ranked = group
      .filter((row) => row.evidence?.performance.overall?.median != null)
      .sort((a, b) => (b.evidence!.performance.overall!.median as number) - (a.evidence!.performance.overall!.median as number))
    ranked.forEach((row, index) => {
      row.roleRank = index + 1
    })
    const ilvls = group.map((row) => row.evidence?.performance.itemLevel?.latest ?? null).filter((v): v is number => v !== null)
    const ilvlMedian = medianOf(ilvls)

    for (const row of group) {
      const evidence = row.evidence
      const median = evidence?.performance.overall?.median ?? null
      const sample = evidence?.performance.sampleSize ?? 0

      if (!evidence || sample < 3) row.tags.push('limitedEvidence')
      if (evidence && sample >= 3 && median !== null && median >= 75) row.tags.push('strongEvidence')
      if (row.roleRank !== null && row.roleTarget !== null && key !== 'unknown' && Math.abs(row.roleRank - row.roleTarget) <= 2) {
        row.tags.push('boundary')
      }
      if (evidence && (evidence.logPresence.reportsPresent < evidence.logPresence.reportsTotal || evidence.fightPresence.satOutKillFights > 0)) {
        row.tags.push('reliabilityNote')
      }
      if (row.entry.availability !== 'available') row.tags.push('availabilityNote')
      const ilvl = evidence?.performance.itemLevel?.latest ?? null
      if (ilvl !== null && ilvlMedian !== null && ilvls.length >= 3 && ilvlMedian - ilvl >= 10) row.tags.push('gearNote')
    }
  }

  return rows
}

export type RosterSortKey =
  | 'name'
  | 'role'
  | 'availability'
  | 'overallMedian'
  | 'overallLatest'
  | 'overallBest'
  | 'bracketMedian'
  | 'itemLevel'
  | 'output'
  | 'logPresence'
  | 'deaths'
  | 'sampleSize'

const ROLE_SORT: Record<RosterRaidRole, number> = { tank: 0, healer: 1, melee: 2, ranged: 3, unknown: 4 }
const AVAIL_SORT = { available: 0, late: 1, absent: 2 } as const

const numericKey = (row: RosterReviewRow, key: RosterSortKey): number | null => {
  const p = row.evidence?.performance
  switch (key) {
    case 'overallMedian': return p?.overall?.median ?? null
    case 'overallLatest': return p?.overall?.latest ?? null
    case 'overallBest': return p?.overall?.best ?? null
    case 'bracketMedian': return p?.bracket?.median ?? null
    case 'itemLevel': return p?.itemLevel?.latest ?? null
    case 'output': return p?.output?.meanAmount ?? null
    case 'logPresence': return row.evidence ? row.evidence.logPresence.reportsPresent : null
    case 'deaths': return row.evidence ? row.evidence.execution.deaths : null
    case 'sampleSize': return p?.sampleSize ?? null
    default: return null
  }
}

/** Sort rows; unknown values always sink to the bottom regardless of direction. */
export const sortRosterRows = (rows: RosterReviewRow[], key: RosterSortKey, direction: 'asc' | 'desc'): RosterReviewRow[] => {
  const sign = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    if (key === 'name') return sign * a.entry.playerName.localeCompare(b.entry.playerName)
    if (key === 'role') return sign * (ROLE_SORT[a.entry.role] - ROLE_SORT[b.entry.role]) || a.entry.playerName.localeCompare(b.entry.playerName)
    if (key === 'availability') return sign * (AVAIL_SORT[a.entry.availability] - AVAIL_SORT[b.entry.availability]) || a.entry.playerName.localeCompare(b.entry.playerName)
    const av = numericKey(a, key)
    const bv = numericKey(b, key)
    if (av === null && bv === null) return a.entry.playerName.localeCompare(b.entry.playerName)
    if (av === null) return 1
    if (bv === null) return -1
    return sign * (av - bv) || a.entry.playerName.localeCompare(b.entry.playerName)
  })
}
