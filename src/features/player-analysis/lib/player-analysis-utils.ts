import type { AvailableBaseline } from '../types/available-baseline'
import type { BenchmarkCandidatesResponse, SelectedBenchmarkCandidate } from '../types/player-analysis.types'

export type BossKillDuplicateRef = {
  reportCode: string
  reportTitle: string
  fightId: number
  startTime: number
  durationMs: number
}

export type BossKillDisplayRow = {
  encounterId: number
  encounterName: string
  difficulty: number
  reportCode: string
  reportTitle: string
  fightId: number
  startTime: number
  durationMs: number
  playerItemLevel?: number | null
  playerSpecName?: string | null
  duplicateReportCount: number
  duplicateReports: BossKillDuplicateRef[]
}

type RawGroupFight = {
  reportCode: string
  reportTitle: string
  fightId: number
  startTime: number
  durationMs: number
  playerItemLevel?: number | null
  playerSpecName?: string | null
  duplicateReportCount?: number
  duplicateReports?: BossKillDuplicateRef[]
}

type RawBossGroup = {
  encounterId: number
  encounterName: string
  difficulty: number
  fights: RawGroupFight[]
}

const BUCKET_MS = 5_000

function bossKillDedupeKey(encounterId: number, encounterName: string, difficulty: number, startTime: number, durationMs: number): string {
  const encounterKey = encounterId > 0
    ? String(encounterId)
    : encounterName.toLowerCase().replace(/\s+/g, '')
  const date = new Date(startTime).toISOString().slice(0, 10)
  const dur = Math.round(durationMs / BUCKET_MS) * BUCKET_MS
  return `${encounterKey}|${difficulty}|${date}|${dur}`
}

function isBetterRepresentative(candidate: BossKillDisplayRow, current: BossKillDisplayRow): boolean {
  // Prefer higher existing duplicate count (backend found more reports)
  if ((candidate.duplicateReportCount) > (current.duplicateReportCount)) return true
  if ((candidate.duplicateReportCount) < (current.duplicateReportCount)) return false
  // Prefer richer metadata
  if (candidate.playerItemLevel != null && current.playerItemLevel == null) return true
  if (candidate.playerItemLevel == null && current.playerItemLevel != null) return false
  if (candidate.playerSpecName != null && current.playerSpecName == null) return true
  return false
}

/**
 * Flatten all boss kill groups into a single deduplicated display list.
 * Deduplication is cross-group so fights that appear in multiple report uploads
 * collapse into one card. The representative row is chosen by richness of
 * metadata; hidden rows are accumulated into duplicateReportCount/duplicateReports.
 */
export function flattenAndDeduplicateBossKills(groups: RawBossGroup[]): BossKillDisplayRow[] {
  const seen = new Map<string, BossKillDisplayRow>()

  for (const group of groups) {
    for (const fight of group.fights) {
      const key = bossKillDedupeKey(group.encounterId, group.encounterName, group.difficulty, fight.startTime, fight.durationMs)
      const incoming: BossKillDisplayRow = {
        encounterId: group.encounterId,
        encounterName: group.encounterName,
        difficulty: group.difficulty,
        reportCode: fight.reportCode,
        reportTitle: fight.reportTitle,
        fightId: fight.fightId,
        startTime: fight.startTime,
        durationMs: fight.durationMs,
        playerItemLevel: fight.playerItemLevel,
        playerSpecName: fight.playerSpecName,
        duplicateReportCount: fight.duplicateReportCount ?? 0,
        duplicateReports: fight.duplicateReports ?? [],
      }

      const existing = seen.get(key)
      if (!existing) {
        seen.set(key, incoming)
        continue
      }

      const preferIncoming = isBetterRepresentative(incoming, existing)
      const representative = preferIncoming ? { ...incoming } : { ...existing }
      const hidden = preferIncoming ? existing : incoming

      // Accumulate: hidden row itself counts as one additional duplicate, plus its own backend duplicates
      representative.duplicateReportCount =
        representative.duplicateReportCount + 1 + hidden.duplicateReportCount
      representative.duplicateReports = [
        ...representative.duplicateReports,
        { reportCode: hidden.reportCode, reportTitle: hidden.reportTitle, fightId: hidden.fightId, startTime: hidden.startTime, durationMs: hidden.durationMs },
        ...hidden.duplicateReports,
      ]
      seen.set(key, representative)
    }
  }

  return Array.from(seen.values())
}

export const countSelectedFights = (selection: Record<string, number[]>): number =>
  Object.values(selection).reduce((sum, fightIds) => sum + fightIds.length, 0)

export const buildBaselineKeysFromFightSelection = (
  preview: {
    includedReports: Array<{
      code: string
      includedFights: Array<{ fightId: number; encounterId?: number; playerPresent: boolean; durationMs: number }>
    }>
  },
  selection: Record<string, number[]>
): Set<string> => {
  const next = new Set<string>()
  for (const report of preview.includedReports ?? []) {
    const selectedFightIds = new Set(selection[report.code] ?? [])
    for (const fight of report.includedFights ?? []) {
      if (!selectedFightIds.has(fight.fightId)) continue
      if ((fight.encounterId ?? 0) <= 0) continue
      if (!fight.playerPresent) continue
      if (fight.durationMs < 60_000) continue
      next.add(`${report.code}:${fight.fightId}`)
    }
  }
  return next
}

export const buildSingleBossDefaultSelection = (preview: {
  recentRaidBossKills?: {
    groups: Array<{
      fights: Array<{ reportCode: string; fightId: number; startTime: number; durationMs: number }>
    }>
  }
  includedReports: Array<{ code: string }>
}): Record<string, number[]> => {
  const selected: Record<string, number[]> = Object.fromEntries(
    (preview.includedReports ?? []).map((report) => [report.code, [] as number[]])
  )
  const candidates = (preview.recentRaidBossKills?.groups ?? []).flatMap((group) =>
    group.fights.map((fight) => ({
      reportCode: fight.reportCode,
      fightId: fight.fightId,
      startTime: fight.startTime ?? 0,
      durationMs: fight.durationMs ?? 0,
    }))
  )
  if (candidates.length === 0) return selected
  candidates.sort((left, right) => {
    if (left.startTime !== right.startTime) return right.startTime - left.startTime
    return right.durationMs - left.durationMs
  })
  const chosen = candidates[0]
  selected[chosen.reportCode] = [chosen.fightId]
  return selected
}

export const buildAllEligibleFightSelection = (preview: {
  includedReports: Array<{
    code: string
    includedFights: Array<{ fightId: number; encounterId?: number; playerPresent: boolean; durationMs: number }>
  }>
}): Record<string, number[]> => {
  const selected: Record<string, number[]> = {}
  for (const report of preview.includedReports ?? []) {
    selected[report.code] = (report.includedFights ?? [])
      .filter((fight) => fight.playerPresent && (fight.encounterId ?? 0) > 0 && fight.durationMs >= 60_000)
      .map((fight) => fight.fightId)
  }
  return selected
}

export const buildSelectedCandidates = (
  baselines: AvailableBaseline[],
  candidatesResult: BenchmarkCandidatesResponse | null,
  selectedKeys: Set<string>,
  selectedCandidateKeysByBaseline: Record<string, string>
): SelectedBenchmarkCandidate[] => {
  if (!candidatesResult) return []
  const result: SelectedBenchmarkCandidate[] = []
  for (const group of candidatesResult.groups ?? []) {
    const baseline = baselines.find(
      (b) => b.reportCode === group.baseline.reportCode && b.fightId === group.baseline.fightId
    )
    if (!baseline || !selectedKeys.has(baseline.key)) continue
    const selectedCandidateKey = selectedCandidateKeysByBaseline[baseline.key]
    if (!selectedCandidateKey) continue
    const selectedCandidate = group.candidates.find((candidateItem) => {
      const reportCode = candidateItem.reportCode ?? ''
      const fightId = candidateItem.fightId ?? 0
      const player = candidateItem.characterName ?? ''
      return `${reportCode}:${fightId}:${player}` === selectedCandidateKey
    })
    const candidate = selectedCandidate
    if (!candidate?.validation.hasUsableExportTarget) continue
    if (!candidate || !candidate.reportCode || typeof candidate.fightId !== 'number') continue
    result.push({
      baselineReportCode: baseline.reportCode,
      baselineFightId: baseline.fightId,
      baselineEncounterId: baseline.encounterId,
      baselineEncounterName: baseline.encounterName,
      baselineDifficulty: baseline.difficulty,
      baselineDurationMs: baseline.durationMs,
      benchmarkPlayerName: candidate.characterName,
      benchmarkReportCode: candidate.reportCode,
      benchmarkFightId: candidate.fightId,
      benchmarkEncounterId: candidate.encounterId,
      benchmarkDifficulty: candidate.difficulty ?? baseline.difficulty,
      benchmarkClassName: candidate.className ?? '',
      benchmarkSpecName: candidate.specName ?? '',
      benchmarkPercentile: candidate.percentile,
      benchmarkCandidateItemLevel: candidate.itemLevel ?? undefined,
      benchmarkItemLevel: candidate.itemLevel ?? undefined,
      benchmarkDurationMs: candidate.durationMs ?? undefined,
    })
  }
  return result
}

export const formatDuration = (ms: number): string => {
  const s = Math.max(Math.floor(ms / 1000), 0)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}
