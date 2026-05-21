import type { NormalizedBenchmarkCandidate } from '../types/player-analysis.types'

export function getExportabilityReasons(candidate: NormalizedBenchmarkCandidate): string[] {
  const reasons: string[] = []
  if (!candidate.validation.sameEncounter) reasons.push('encounter mismatch')
  if (!candidate.validation.sameDifficulty) reasons.push('difficulty mismatch')
  if (!candidate.validation.sameClass) reasons.push('class mismatch')
  if (!candidate.validation.sameSpec) reasons.push('spec mismatch')
  if (!candidate.validation.hasUsablePlayerName) reasons.push('player name hidden/private')
  if (!candidate.validation.hasReportCode) reasons.push('missing report code')
  if (!candidate.validation.hasFightId) reasons.push('missing fight ID')
  return reasons
}

export function getCandidateKey(candidate: NormalizedBenchmarkCandidate): string {
  return `${candidate.reportCode ?? ''}:${candidate.fightId ?? 0}:${candidate.characterName ?? ''}`
}
