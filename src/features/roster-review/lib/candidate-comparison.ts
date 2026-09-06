import type { RosterAvailabilityEntry, RosterPlayerEvidence } from '../types/roster-review.types'
import { RAID_ROLE_LABELS } from './spec-raid-role'

export type ComparisonVerdict = 'aAdvantage' | 'bAdvantage' | 'roughlyEqual' | 'insufficient'

export type ComparisonDimension = {
  key: 'performance' | 'consistency' | 'attendance' | 'gear' | 'execution' | 'availability' | 'composition'
  label: string
  verdict: ComparisonVerdict
  aValue: string
  bValue: string
  detail: string
}

export type CandidateComparison = {
  a: { name: string; entry: RosterAvailabilityEntry | null; evidence: RosterPlayerEvidence | null }
  b: { name: string; entry: RosterAvailabilityEntry | null; evidence: RosterPlayerEvidence | null }
  dimensions: ComparisonDimension[]
  /** Editable starting point for the officer's explanation; never a verdict. */
  draftExplanation: string
}

// Thresholds are deliberately visible in the UI; they describe "material" differences, not scores.
export const COMPARISON_THRESHOLDS = {
  /** Points of median overall parse treated as a material difference. */
  performancePoints: 10,
  /** Points of overall spread treated as a material consistency difference. */
  spreadPoints: 15,
  /** Item level points treated as a material gear gap. */
  itemLevelPoints: 8,
} as const

const fmt = (value: number | null | undefined, suffix = ''): string => (value === null || value === undefined ? 'unknown' : `${value}${suffix}`)

const compareHigherIsBetter = (a: number | null, b: number | null, threshold: number): ComparisonVerdict => {
  if (a === null || b === null) return 'insufficient'
  if (a - b >= threshold) return 'aAdvantage'
  if (b - a >= threshold) return 'bAdvantage'
  return 'roughlyEqual'
}

const compareLowerIsBetter = (a: number | null, b: number | null, threshold: number): ComparisonVerdict => {
  if (a === null || b === null) return 'insufficient'
  if (b - a >= threshold) return 'aAdvantage'
  if (a - b >= threshold) return 'bAdvantage'
  return 'roughlyEqual'
}

const verdictWord = (verdict: ComparisonVerdict, a: string, b: string): string => {
  if (verdict === 'aAdvantage') return `${a} advantage`
  if (verdict === 'bAdvantage') return `${b} advantage`
  if (verdict === 'roughlyEqual') return 'roughly equal'
  return 'insufficient evidence'
}

export const buildCandidateComparison = (
  a: { name: string; entry: RosterAvailabilityEntry | null; evidence: RosterPlayerEvidence | null },
  b: { name: string; entry: RosterAvailabilityEntry | null; evidence: RosterPlayerEvidence | null }
): CandidateComparison => {
  const pa = a.evidence?.performance
  const pb = b.evidence?.performance
  const dims: ComparisonDimension[] = []

  // Performance: median overall parse (primary), latest as context.
  const aMedian = pa?.overall?.median ?? null
  const bMedian = pb?.overall?.median ?? null
  const perf = compareHigherIsBetter(aMedian, bMedian, COMPARISON_THRESHOLDS.performancePoints)
  dims.push({
    key: 'performance',
    label: 'Performance (overall parse, median)',
    verdict: perf,
    aValue: `${fmt(aMedian)} median · ${fmt(pa?.overall?.latest)} latest · ${fmt(pa?.sampleSize)} kills`,
    bValue: `${fmt(bMedian)} median · ${fmt(pb?.overall?.latest)} latest · ${fmt(pb?.sampleSize)} kills`,
    detail:
      perf === 'insufficient'
        ? 'One or both players have no ranked kills in the window.'
        : `Difference of ${Math.abs((aMedian ?? 0) - (bMedian ?? 0)).toFixed(0)} points; ${COMPARISON_THRESHOLDS.performancePoints}+ is treated as material.`,
  })

  // Consistency: spread and best-vs-median.
  const aSpread = a.evidence?.consistency.spread ?? null
  const bSpread = b.evidence?.consistency.spread ?? null
  const smallA = (pa?.sampleSize ?? 0) < 3
  const smallB = (pb?.sampleSize ?? 0) < 3
  const cons = smallA || smallB ? 'insufficient' : compareLowerIsBetter(aSpread, bSpread, COMPARISON_THRESHOLDS.spreadPoints)
  dims.push({
    key: 'consistency',
    label: 'Consistency (spread of overall parse)',
    verdict: cons,
    aValue: `${fmt(aSpread)} spread · best ${fmt(pa?.overall?.best)} · worst ${fmt(pa?.overall?.worst)}`,
    bValue: `${fmt(bSpread)} spread · best ${fmt(pb?.overall?.best)} · worst ${fmt(pb?.overall?.worst)}`,
    detail:
      cons === 'insufficient'
        ? 'Needs at least 3 ranked kills per player to say anything about consistency.'
        : `Lower spread is steadier; ${COMPARISON_THRESHOLDS.spreadPoints}+ points difference is treated as material.`,
  })

  // Attendance: log presence (labelled as such).
  const la = a.evidence?.logPresence ?? null
  const lb = b.evidence?.logPresence ?? null
  let att: ComparisonVerdict = 'insufficient'
  if (la && lb && la.reportsTotal > 0) {
    att = la.reportsPresent === lb.reportsPresent ? 'roughlyEqual' : la.reportsPresent > lb.reportsPresent ? 'aAdvantage' : 'bAdvantage'
  }
  dims.push({
    key: 'attendance',
    label: 'Log presence (selected reports)',
    verdict: att,
    aValue: la ? `${la.reportsPresent}/${la.reportsTotal} logs · sat out ${a.evidence?.fightPresence.satOutKillFights ?? 0} kill fights` : 'unknown',
    bValue: lb ? `${lb.reportsPresent}/${lb.reportsTotal} logs · sat out ${b.evidence?.fightPresence.satOutKillFights ?? 0} kill fights` : 'unknown',
    detail: 'Presence in logs only. Excused absences are not visible here; check signup notes.',
  })

  // Gear.
  const aIlvl = pa?.itemLevel?.latest ?? null
  const bIlvl = pb?.itemLevel?.latest ?? null
  const gear = compareHigherIsBetter(aIlvl, bIlvl, COMPARISON_THRESHOLDS.itemLevelPoints)
  dims.push({
    key: 'gear',
    label: 'Gear (latest item level) with ilvl-bracket parse as context',
    verdict: gear,
    aValue: `${fmt(aIlvl)} ilvl · bracket median ${fmt(pa?.bracket?.median)}`,
    bValue: `${fmt(bIlvl)} ilvl · bracket median ${fmt(pb?.bracket?.median)}`,
    detail: 'Bracket parse shows efficiency for the gear worn; overall parse remains the primary output context.',
  })

  // Execution (deaths on checked kill fights).
  const ea = a.evidence?.execution ?? null
  const eb = b.evidence?.execution ?? null
  let exec: ComparisonVerdict = 'insufficient'
  if (ea && eb && ea.killFightsChecked > 0 && eb.killFightsChecked > 0) {
    const ra = ea.fightsWithDeath / ea.killFightsChecked
    const rb = eb.fightsWithDeath / eb.killFightsChecked
    exec = Math.abs(ra - rb) < 0.2 ? 'roughlyEqual' : ra < rb ? 'aAdvantage' : 'bAdvantage'
  }
  dims.push({
    key: 'execution',
    label: 'Execution (deaths on kill fights)',
    verdict: exec,
    aValue: ea ? `${ea.deaths} deaths in ${ea.fightsWithDeath}/${ea.killFightsChecked} checked kills` : 'unknown',
    bValue: eb ? `${eb.deaths} deaths in ${eb.fightsWithDeath}/${eb.killFightsChecked} checked kills` : 'unknown',
    detail: 'Deaths are a signal, not a verdict. Review the fight before attributing fault.',
  })

  // Availability for the target raid (officer-entered).
  const availRank = { available: 0, late: 1, absent: 2 } as const
  const av = a.entry?.availability ?? null
  const bv = b.entry?.availability ?? null
  let avail: ComparisonVerdict = 'insufficient'
  if (av && bv) avail = availRank[av] === availRank[bv] ? 'roughlyEqual' : availRank[av] < availRank[bv] ? 'aAdvantage' : 'bAdvantage'
  dims.push({
    key: 'availability',
    label: 'Availability for target raid (officer entry)',
    verdict: avail,
    aValue: av ? `${av}${a.entry?.note ? ` — ${a.entry.note}` : ''}` : 'not entered',
    bValue: bv ? `${bv}${b.entry?.note ? ` — ${b.entry.note}` : ''}` : 'not entered',
    detail: 'Entered manually by officers for the target raid.',
  })

  // Composition: factual only.
  const describe = (side: typeof a) =>
    [side.evidence?.className ?? side.entry?.className ?? 'unknown class', side.evidence?.primarySpecName ?? 'unknown spec', RAID_ROLE_LABELS[side.entry?.role ?? 'unknown']].join(' / ')
  dims.push({
    key: 'composition',
    label: 'Composition (class / spec / raid role)',
    verdict: 'insufficient',
    aValue: describe(a),
    bValue: describe(b),
    detail: 'Composition needs are an officer judgement. Record the requirement in the explanation if it decides the case.',
  })

  const lines = dims
    .filter((dim) => dim.key !== 'composition')
    .map((dim) => `${dim.label.split(' (')[0]}: ${verdictWord(dim.verdict, a.name, b.name)}`)
  const draftExplanation = [`${a.name} vs ${b.name}`, ...lines, `Composition: ${describe(a)} vs ${describe(b)}`, 'Conclusion: '].join('\n')

  return { a, b, dimensions: dims, draftExplanation }
}

export const verdictLabel = (verdict: ComparisonVerdict, aName: string, bName: string): string => verdictWord(verdict, aName, bName)
