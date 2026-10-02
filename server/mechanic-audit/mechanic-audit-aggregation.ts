import type {
  MechanicAuditFightRecord,
  MechanicAuditMechanic,
  MechanicAuditMechanicSummary,
  MechanicAuditNoTransitionFallback,
  MechanicAuditPhaseBoundarySource,
  MechanicAuditPhaseOneBoundary,
  MechanicAuditPlayerInfo,
  MechanicAuditPlayerMechanicSummary,
  MechanicAuditThresholds,
  MechanicDistributionClassification,
  MechanicHit,
  MechanicOccurrenceQuality,
} from './mechanic-audit.types'
import { resolveEventAbilityId, resolveEventAbilityName, type RawWclEvent } from './mechanic-audit-event-fetcher'

// ---------------------------------------------------------------------------
// Identity & date helpers
// ---------------------------------------------------------------------------

/**
 * WCL report-local actor IDs are not stable across reports, so cross-report
 * aggregation must key on the (case-insensitive) player name, per spec.
 */
export const normalizePlayerName = (name: string): string => name.trim().toLowerCase()

export const computeRaidDate = (absoluteEpochMs: number, timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(absoluteEpochMs)
  )

// ---------------------------------------------------------------------------
// Pull numbering
// ---------------------------------------------------------------------------

export const assignPullNumbers = <T extends { fightStartTime: number }>(fights: T[]): Array<T & { pullNumber: number }> =>
  [...fights]
    .sort((a, b) => a.fightStartTime - b.fightStartTime)
    .map((fight, index) => ({ ...fight, pullNumber: index + 1 }))

// ---------------------------------------------------------------------------
// Phase 1 boundary resolution
// ---------------------------------------------------------------------------

export type PhaseTransitionInput = { id: number; startTime: number }

export type BoundaryFightInput = {
  fightId: number
  fightStartTime: number
  fightEndTime: number
  durationMs: number
  /**
   * Whether the pull ended in a kill. A kill on a multi-phase encounter is itself evidence
   * that later phases were reached, so a missing phase-transition record on a kill can never
   * be safely papered over with a fight-end fallback (the fight-end fallback is a "this pull
   * never left Phase 1" bet, and a kill disproves that bet by construction). Wipes carry no
   * such evidence either way, which is what makes the fallback safe for them specifically.
   */
  kill: boolean
}

/**
 * `phaseOneEndMs` here is report-relative (same scale as fight.startTime), matching every other
 * timestamp this function receives. Callers are responsible for deriving the fight-relative value
 * before exporting it — see `deriveFightRelativePhaseOneEnd`.
 */
export type PhaseBoundaryResolution =
  | {
      resolved: true
      phaseOneEndMs: number
      source: MechanicAuditPhaseBoundarySource
      /** Low-severity diagnostic note (e.g. "resolved via fight-end fallback for a wipe"). Never treated as an exclusion. */
      diagnostic?: string
    }
  | { resolved: false; source: 'unresolved'; warning: string }

const findFirstMarkerTimestamp = (fight: BoundaryFightInput, markerEventTimestamps: number[] | undefined): number | undefined =>
  (markerEventTimestamps ?? [])
    .filter((t) => t >= fight.fightStartTime && t <= fight.fightEndTime)
    .sort((a, b) => a - b)[0]

const resolveNoTransitionFallback = (
  fight: BoundaryFightInput,
  phase: number,
  fallback: MechanicAuditNoTransitionFallback,
  context: { markerEventTimestamps?: number[] }
): PhaseBoundaryResolution => {
  if (fight.kill) {
    // A kill proves later phases were reached — fight-end can never stand in for a missing
    // transition here, since "the fight never left Phase 1" is provably false for a kill.
    if (fallback.mode === 'markerAbilityThenFightEndForWipes') {
      const marker = findFirstMarkerTimestamp(fight, context.markerEventTimestamps)
      if (marker !== undefined) {
        return {
          resolved: true,
          phaseOneEndMs: marker,
          source: 'markerAbilityFallback',
          diagnostic: `Fight ${fight.fightId}: phase-transition for phase ${phase} was not found on this kill; resolved via configured marker-ability fallback.`,
        }
      }
    }
    return {
      resolved: false,
      source: 'unresolved',
      warning: `Fight ${fight.fightId}: kill with no phase-transition record and no marker-ability evidence resolved; excluded rather than assumed all-Phase-1 (a kill implies Phase 2 was reached, so fight-end cannot be used as a fallback here).`,
    }
  }

  // Wipe: no evidence either way that Phase 2 was reached, so a fight-end fallback is a
  // defensible, explicitly-configured guess — but only when the officer opted into it.
  if (fallback.mode === 'fightEndForWipes') {
    return {
      resolved: true,
      phaseOneEndMs: fight.fightEndTime,
      source: 'fightEndBeforePhaseTransition',
      diagnostic: `Fight ${fight.fightId}: phase-transition for phase ${phase} was not found on this wipe; resolved via configured fight-end fallback (treated as never having left Phase 1).`,
    }
  }

  if (fallback.mode === 'markerAbilityThenFightEndForWipes') {
    const marker = findFirstMarkerTimestamp(fight, context.markerEventTimestamps)
    if (marker !== undefined) {
      return {
        resolved: true,
        phaseOneEndMs: marker,
        source: 'markerAbilityFallback',
        diagnostic: `Fight ${fight.fightId}: phase-transition for phase ${phase} was not found; resolved via configured marker-ability fallback.`,
      }
    }
    return {
      resolved: true,
      phaseOneEndMs: fight.fightEndTime,
      source: 'fightEndBeforePhaseTransition',
      diagnostic: `Fight ${fight.fightId}: phase-transition for phase ${phase} was not found and the configured marker ability never fired on this wipe; resolved via fight-end fallback.`,
    }
  }

  return {
    resolved: false,
    source: 'unresolved',
    warning: `Fight ${fight.fightId}: phase-transition boundary for phase ${phase} was not found; excluded from Phase 1 analysis (no fallback configured).`,
  }
}

export const resolvePhaseOneBoundary = (
  fight: BoundaryFightInput,
  boundary: MechanicAuditPhaseOneBoundary,
  context: { phaseTransitions?: PhaseTransitionInput[]; markerEventTimestamps?: number[] }
): PhaseBoundaryResolution => {
  if (boundary.mode === 'phaseTransition') {
    const transition = (context.phaseTransitions ?? []).find((t) => t.id === boundary.phase)
    if (transition) {
      return { resolved: true, phaseOneEndMs: transition.startTime, source: 'phaseTransition' }
    }
    return resolveNoTransitionFallback(fight, boundary.phase, boundary.noTransitionFallback ?? { mode: 'exclude' }, context)
  }

  if (boundary.mode === 'markerAbility') {
    const first = findFirstMarkerTimestamp(fight, context.markerEventTimestamps)
    if (first === undefined) {
      return {
        resolved: false,
        source: 'unresolved',
        warning: `Fight ${fight.fightId}: no marker-ability event was found inside the fight; excluded from Phase 1 analysis.`,
      }
    }
    return { resolved: true, phaseOneEndMs: first, source: 'markerAbility' }
  }

  const clamped = Math.min(Math.max(boundary.endTimeMs, 0), fight.durationMs)
  return {
    resolved: true,
    phaseOneEndMs: fight.fightStartTime + clamped,
    source: 'fightRelativeTimestamp',
    diagnostic: `Fight ${fight.fightId}: Phase 1 boundary set from a fixed, manually-configured fight-relative timestamp — approximate, not derived from this pull's own data.`,
  }
}

// ---------------------------------------------------------------------------
// Report-relative -> fight-relative conversion, with the boundary invariant
// ---------------------------------------------------------------------------

export type PhaseOneEndDerivation =
  | { ok: true; reportRelativeMs: number; fightRelativeMs: number }
  | { ok: false; error: string }

/** Enforces 0 <= fightRelativeMs <= durationMs. On violation, the caller must exclude the fight rather than export a misleading timestamp. */
export const deriveFightRelativePhaseOneEnd = (
  fight: { fightId: number; fightStartTime: number; durationMs: number },
  reportRelativeMs: number
): PhaseOneEndDerivation => {
  const fightRelativeMs = reportRelativeMs - fight.fightStartTime
  if (fightRelativeMs < 0 || fightRelativeMs > fight.durationMs) {
    return {
      ok: false,
      error: `Fight ${fight.fightId}: computed Phase 1 end (fight-relative ${fightRelativeMs}ms) falls outside the fight's own duration (0-${fight.durationMs}ms); excluded to avoid exporting an invalid timestamp.`,
    }
  }
  return { ok: true, reportRelativeMs, fightRelativeMs }
}

// ---------------------------------------------------------------------------
// Cross-report duplicate-pull detection
// ---------------------------------------------------------------------------

export type DuplicateFightCandidate = {
  reportCode: string
  fightId: number
  absoluteStartTime: number
  durationMs: number
  bossPercentage: number | null
  kill: boolean
  /** Normalized (case-insensitive) player names present in the fight — used for roster overlap, since WCL actor IDs are report-local. */
  playerNames: Set<string>
}

export type DuplicateFightInfo = {
  groupId: string
  isCanonical: boolean
  canonicalReportCode: string
  canonicalFightId: number
  duplicateReportCodes: string[]
  confidence: 'high' | 'medium' | 'low'
}

const duplicateFightKey = (reportCode: string, fightId: number): string => `${reportCode}::${fightId}`

const rosterOverlapRatio = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const name of a) if (b.has(name)) shared += 1
  return shared / Math.min(a.size, b.size)
}

/**
 * Conservative fingerprint match across reports: absolute start time and duration must both be
 * within tolerance, the kill/wipe outcome and boss percentage must agree, and rosters must
 * substantially overlap. Deliberately does NOT merge on duration alone (a common trap — two
 * unrelated pulls of similar length are not duplicates), and deliberately does not attempt
 * mechanic-event fingerprinting (that would require events to already be fetched, which happens
 * after this pass runs — documented as a limitation, not implemented).
 */
export const detectDuplicateFights = (
  candidates: DuplicateFightCandidate[],
  options?: { startTimeToleranceMs?: number; durationToleranceMs?: number; bossPercentageTolerance?: number; minimumRosterOverlap?: number }
): Map<string, DuplicateFightInfo> => {
  const startTolerance = options?.startTimeToleranceMs ?? 5_000
  const durationTolerance = options?.durationToleranceMs ?? 3_000
  const bossPercentageTolerance = options?.bossPercentageTolerance ?? 0.5
  const minimumRosterOverlap = options?.minimumRosterOverlap ?? 0.5

  const isMatch = (a: DuplicateFightCandidate, b: DuplicateFightCandidate): boolean => {
    if (a.reportCode === b.reportCode) return false
    if (a.kill !== b.kill) return false
    if (Math.abs(a.absoluteStartTime - b.absoluteStartTime) > startTolerance) return false
    if (Math.abs(a.durationMs - b.durationMs) > durationTolerance) return false
    if (a.bossPercentage !== null && b.bossPercentage !== null) {
      if (Math.abs(a.bossPercentage - b.bossPercentage) > bossPercentageTolerance) return false
    }
    return rosterOverlapRatio(a.playerNames, b.playerNames) >= minimumRosterOverlap
  }

  const sorted = [...candidates].sort((a, b) => a.absoluteStartTime - b.absoluteStartTime)
  const assigned = new Set<string>()
  const groups: DuplicateFightCandidate[][] = []

  for (const candidate of sorted) {
    const key = duplicateFightKey(candidate.reportCode, candidate.fightId)
    if (assigned.has(key)) continue
    const group = [candidate]
    assigned.add(key)
    for (const other of sorted) {
      const otherKey = duplicateFightKey(other.reportCode, other.fightId)
      if (assigned.has(otherKey)) continue
      if (!isMatch(candidate, other)) continue
      group.push(other)
      assigned.add(otherKey)
    }
    groups.push(group)
  }

  const result = new Map<string, DuplicateFightInfo>()
  for (const group of groups) {
    if (group.length <= 1) continue
    const sortedGroup = [...group].sort(
      (a, b) => a.reportCode.localeCompare(b.reportCode) || a.absoluteStartTime - b.absoluteStartTime
    )
    const canonical = sortedGroup[0]
    const groupId = `dup-${duplicateFightKey(canonical.reportCode, canonical.fightId)}`
    const others = sortedGroup.slice(1)
    const overlaps = others.map((f) => rosterOverlapRatio(canonical.playerNames, f.playerNames))
    const confidence: DuplicateFightInfo['confidence'] = overlaps.every((o) => o >= 0.9)
      ? 'high'
      : overlaps.every((o) => o >= 0.7)
        ? 'medium'
        : 'low'
    for (const member of sortedGroup) {
      result.set(duplicateFightKey(member.reportCode, member.fightId), {
        groupId,
        isCanonical: member === canonical,
        canonicalReportCode: canonical.reportCode,
        canonicalFightId: canonical.fightId,
        duplicateReportCodes: others.map((f) => f.reportCode),
        confidence,
      })
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Event -> fight mapping and Phase 1 filtering
// ---------------------------------------------------------------------------

export type FightTimeWindow = { fightId: number; fightStartTime: number; fightEndTime: number }

export const mapEventsToFights = (events: RawWclEvent[], fights: FightTimeWindow[]): Map<number, RawWclEvent[]> => {
  const byFight = new Map<number, RawWclEvent[]>()
  for (const fight of fights) byFight.set(fight.fightId, [])

  for (const event of events) {
    const ts = event.timestamp
    if (typeof ts !== 'number') continue
    const fight = fights.find((f) => ts >= f.fightStartTime && ts <= f.fightEndTime)
    if (!fight) continue
    byFight.get(fight.fightId)?.push(event)
  }

  return byFight
}

/** phaseOneEndMs here is report-relative, matching event.timestamp's scale. Boundary itself is exclusive (strict `<`): an event landing exactly at the boundary is treated as Phase 2. */
export const filterEventsWithinPhaseOne = (events: RawWclEvent[], phaseOneEndMs: number): RawWclEvent[] =>
  events.filter((event) => typeof event.timestamp === 'number' && event.timestamp < phaseOneEndMs)

// ---------------------------------------------------------------------------
// Raw mechanic occurrences
// ---------------------------------------------------------------------------

export type RawOccurrence = {
  reportCode: string
  fightId: number
  mechanicKey: string
  mechanicLabel: string
  abilityId: number
  abilityName: string
  playerId: number
  timestamp: number
  amount: number | null
  absorbed: number | null
  overkill: number | null
}

export const extractMechanicOccurrences = (params: {
  reportCode: string
  fightId: number
  events: RawWclEvent[]
  abilityIdToMechanic: Map<number, MechanicAuditMechanic>
}): RawOccurrence[] => {
  const occurrences: RawOccurrence[] = []
  for (const event of params.events) {
    const abilityId = resolveEventAbilityId(event)
    if (abilityId === undefined) continue
    const mechanic = params.abilityIdToMechanic.get(abilityId)
    if (!mechanic) continue
    if (typeof event.targetID !== 'number' || typeof event.timestamp !== 'number') continue

    occurrences.push({
      reportCode: params.reportCode,
      fightId: params.fightId,
      mechanicKey: mechanic.key,
      mechanicLabel: mechanic.label,
      abilityId,
      abilityName: resolveEventAbilityName(event) ?? `Ability ${abilityId}`,
      playerId: event.targetID,
      timestamp: event.timestamp,
      amount: typeof event.amount === 'number' ? event.amount : null,
      absorbed: typeof event.absorbed === 'number' ? event.absorbed : null,
      overkill: typeof event.overkill === 'number' ? event.overkill : null,
    })
  }
  return occurrences
}

/**
 * Independent evidence that a mechanic occurred (boss cast/debuff/etc.), keyed by fight+mechanic,
 * regardless of whether any player was hit. Source events use `sourceID`/no target requirement,
 * unlike damage-taken occurrences.
 */
export const extractOccurrenceEvidenceTimestamps = (params: {
  fightId: number
  events: RawWclEvent[]
  occurrenceAbilityIdToMechanicKey: Map<number, string>
}): Map<string, number[]> => {
  const byMechanic = new Map<string, number[]>()
  for (const event of params.events) {
    if (typeof event.timestamp !== 'number') continue
    const abilityId = resolveEventAbilityId(event)
    if (abilityId === undefined) continue
    const mechanicKey = params.occurrenceAbilityIdToMechanicKey.get(abilityId)
    if (!mechanicKey) continue
    const list = byMechanic.get(mechanicKey)
    if (list) list.push(event.timestamp)
    else byMechanic.set(mechanicKey, [event.timestamp])
  }
  return byMechanic
}

// ---------------------------------------------------------------------------
// Mechanic-occurrence denominator (three-tier rule)
// ---------------------------------------------------------------------------

/**
 * (1) Independent occurrence evidence (configured cast/debuff/buff) found in Phase 1 -> confirmed,
 * 'verified'. (2) No independent evidence but a damage hit still landed -> confirmed via the hit
 * itself (the safety net for a detector that missed something), 'approximateFromDamage'. (3)
 * Neither -> did not occur; 'verified' absence if occurrence config existed and was checked,
 * otherwise an unconfirmed 'approximateFromDamage' guess (never a silent "did not occur").
 */
export const resolveMechanicOccurrence = (params: {
  hasOccurrenceConfig: boolean
  occurrenceTimestampsInPhase1: number[]
  dedupedOccurrenceCount: number
}): { mechanicOccurred: boolean; mechanicOccurrenceQuality: MechanicOccurrenceQuality } => {
  if (params.hasOccurrenceConfig && params.occurrenceTimestampsInPhase1.length > 0) {
    return { mechanicOccurred: true, mechanicOccurrenceQuality: 'verified' }
  }
  if (params.dedupedOccurrenceCount > 0) {
    return { mechanicOccurred: true, mechanicOccurrenceQuality: 'approximateFromDamage' }
  }
  return {
    mechanicOccurred: false,
    mechanicOccurrenceQuality: params.hasOccurrenceConfig ? 'verified' : 'approximateFromDamage',
  }
}

// ---------------------------------------------------------------------------
// Deduplication
// ---------------------------------------------------------------------------

export type DedupedOccurrence = RawOccurrence & { rawEventCount: number }

/**
 * Collapses events within dedupeWindowMs of the earliest event in a cluster,
 * grouped by report+fight+mechanic+targetPlayer. Never merges across players.
 */
export const dedupeMechanicOccurrences = (occurrences: RawOccurrence[], dedupeWindowMs: number): DedupedOccurrence[] => {
  const groups = new Map<string, RawOccurrence[]>()
  for (const occ of occurrences) {
    const key = `${occ.reportCode}::${occ.fightId}::${occ.mechanicKey}::${occ.playerId}`
    const group = groups.get(key)
    if (group) group.push(occ)
    else groups.set(key, [occ])
  }

  const result: DedupedOccurrence[] = []
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => a.timestamp - b.timestamp)
    let cluster: DedupedOccurrence | null = null
    for (const occ of sorted) {
      if (cluster && occ.timestamp - cluster.timestamp <= dedupeWindowMs) {
        cluster.amount = (cluster.amount ?? 0) + (occ.amount ?? 0)
        cluster.absorbed = (cluster.absorbed ?? 0) + (occ.absorbed ?? 0)
        cluster.overkill = (cluster.overkill ?? 0) + (occ.overkill ?? 0)
        cluster.rawEventCount += 1
        continue
      }
      cluster = { ...occ, rawEventCount: 1 }
      result.push(cluster)
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Death-based "alive at occurrence" approximation
// ---------------------------------------------------------------------------

export type DeathEvent = { playerId: number; timestamp: number }

export const extractDeathEvents = (events: RawWclEvent[]): DeathEvent[] =>
  events
    .filter((e) => typeof e.targetID === 'number' && typeof e.timestamp === 'number')
    .map((e) => ({ playerId: e.targetID as number, timestamp: e.timestamp as number }))

export const firstDeathTimestampByPlayer = (deaths: DeathEvent[]): Map<number, number> => {
  const map = new Map<number, number>()
  for (const death of deaths) {
    const existing = map.get(death.playerId)
    if (existing === undefined || death.timestamp < existing) map.set(death.playerId, death.timestamp)
  }
  return map
}

/**
 * Conservative approximation: a player is "alive for an occurrence" if their first
 * death in the fight (if any) happened at or after that occurrence's timestamp.
 * This does not account for combat resurrection, per the spec's documented limitation.
 */
export const isPlayerEligibleForMechanic = (params: {
  playerId: number
  participated: boolean
  phaseOneResolved: boolean
  mechanicOccurred: boolean
  mechanicOccurrenceTimestamps: number[]
  firstDeathTimestamp?: number
}): boolean => {
  if (!params.participated || !params.phaseOneResolved || !params.mechanicOccurred) return false
  if (params.firstDeathTimestamp === undefined) return true
  return params.mechanicOccurrenceTimestamps.some((t) => t < (params.firstDeathTimestamp as number))
}

// ---------------------------------------------------------------------------
// MechanicHit rows (events.csv / audit.json)
// ---------------------------------------------------------------------------

export type FightForAggregation = MechanicAuditFightRecord

export const buildMechanicHits = (params: {
  fight: FightForAggregation
  dedupedOccurrences: DedupedOccurrence[]
  players: Map<number, MechanicAuditPlayerInfo>
  firstDeathTimestamp: Map<number, number>
  timezone: string
}): MechanicHit[] =>
  params.dedupedOccurrences.map((occ) => {
    const player = params.players.get(occ.playerId)
    const deathTs = params.firstDeathTimestamp.get(occ.playerId)
    const diedWithin5Seconds = deathTs !== undefined && deathTs >= occ.timestamp && deathTs - occ.timestamp <= 5000

    return {
      raidDate: computeRaidDate(params.fight.reportStartTime + params.fight.fightStartTime, params.timezone),
      reportCode: params.fight.reportCode,
      reportTitle: params.fight.reportTitle,
      fightId: params.fight.fightId,
      pullNumber: params.fight.pullNumber,
      encounterId: params.fight.encounterId,
      encounterName: params.fight.encounterName,
      difficulty: params.fight.difficulty,
      kill: params.fight.kill,
      bossPercentage: params.fight.bossPercentage ?? null,
      fightRelativeTimestampMs: occ.timestamp - params.fight.fightStartTime,
      phase: 1 as const,
      playerId: occ.playerId,
      playerName: player?.playerName ?? `Unknown (${occ.playerId})`,
      playerClass: player?.playerClass ?? null,
      mechanicKey: occ.mechanicKey,
      mechanicLabel: occ.mechanicLabel,
      abilityId: occ.abilityId,
      abilityName: occ.abilityName,
      amount: occ.amount,
      absorbed: occ.absorbed,
      overkill: occ.overkill,
      diedWithin5Seconds,
      rawEventCount: occ.rawEventCount,
    }
  })

// ---------------------------------------------------------------------------
// Per-pull, per-mechanic records (pull-summary.csv source + eligibility base unit)
// ---------------------------------------------------------------------------

export type PullMechanicPlayerRef = {
  playerId: number
  playerName: string
  playerClass?: string | null
  normalizedName: string
}

export type RejectedHitReason = 'diedBeforeOccurrence' | 'notEligible' | 'phaseOneUnresolved'

export type RejectedHit = {
  playerId: number
  playerName: string
  timestamp: number
  reason: RejectedHitReason
}

export type PullMechanicRecord = {
  reportCode: string
  reportTitle: string
  fightId: number
  pullNumber: number
  pullTimestampMs: number
  raidDate: string
  kill: boolean
  bossPercentage?: number | null
  fightDurationMs: number
  /** Fight-relative ms, 0 <= phaseOneEndMs <= fightDurationMs, or null if unresolved. */
  phaseOneEndMs: number | null
  phaseBoundarySource: FightForAggregation['phaseBoundarySource']
  mechanicKey: string
  mechanicLabel: string
  mechanicOccurred: boolean
  mechanicOccurrenceQuality: MechanicOccurrenceQuality
  eligiblePlayers: PullMechanicPlayerRef[]
  /** Accepted hits only — see rejectedHits for hits that were dropped and why. */
  hitPlayers: PullMechanicPlayerRef[]
  /** Accepted (deduped) occurrences only. Every player here is guaranteed to be present in eligiblePlayers. */
  dedupedOccurrences: DedupedOccurrence[]
  rejectedHits: RejectedHit[]
  firstHitFightRelativeMs: number | null
  isDuplicate: boolean
  duplicateGroupId?: string
  canonicalReportCode?: string
}

export const buildPullMechanicRecord = (params: {
  fight: FightForAggregation
  mechanic: MechanicAuditMechanic
  /** All deduped occurrences before eligibility/acceptance filtering. */
  dedupedOccurrences: DedupedOccurrence[]
  mechanicOccurred: boolean
  mechanicOccurrenceQuality: MechanicOccurrenceQuality
  players: Map<number, MechanicAuditPlayerInfo>
  firstDeathTimestamp: Map<number, number>
  timezone: string
}): PullMechanicRecord => {
  const { fight, mechanic, dedupedOccurrences, mechanicOccurred, mechanicOccurrenceQuality, players, firstDeathTimestamp, timezone } =
    params
  const phaseOneResolved = fight.phaseOneEndFightRelativeMs !== null
  const occurrenceTimestamps = dedupedOccurrences.map((o) => o.timestamp)

  const toRef = (playerId: number): PullMechanicPlayerRef | null => {
    const info = players.get(playerId)
    if (!info) return null
    return {
      playerId,
      playerName: info.playerName,
      playerClass: info.playerClass,
      normalizedName: normalizePlayerName(info.playerName),
    }
  }

  // A recorded hit is itself evidence of participation, so the eligible pool must include hit
  // players even when WCL's own participation metadata (friendlyPlayerIds) omits them — this is
  // what keeps eligiblePlayers a superset of accepted hitPlayers below.
  const hitPlayerIds = new Set(dedupedOccurrences.map((o) => o.playerId))
  const candidatePlayerIds = new Set<number>([...fight.friendlyPlayerIds, ...hitPlayerIds])

  const eligiblePlayers: PullMechanicPlayerRef[] = []
  for (const playerId of candidatePlayerIds) {
    const eligible = isPlayerEligibleForMechanic({
      playerId,
      participated: true,
      phaseOneResolved,
      mechanicOccurred,
      mechanicOccurrenceTimestamps: occurrenceTimestamps,
      firstDeathTimestamp: firstDeathTimestamp.get(playerId),
    })
    if (!eligible) continue
    const ref = toRef(playerId)
    if (ref) eligiblePlayers.push(ref)
  }
  const eligiblePlayerIds = new Set(eligiblePlayers.map((r) => r.playerId))

  const acceptedOccurrences: DedupedOccurrence[] = []
  const rejectedHits: RejectedHit[] = []
  for (const occ of dedupedOccurrences) {
    const ref = toRef(occ.playerId)
    const playerName = ref?.playerName ?? `Unknown (${occ.playerId})`

    if (!phaseOneResolved) {
      rejectedHits.push({ playerId: occ.playerId, playerName, timestamp: occ.timestamp, reason: 'phaseOneUnresolved' })
      continue
    }
    const deathTs = firstDeathTimestamp.get(occ.playerId)
    if (deathTs !== undefined && occ.timestamp > deathTs) {
      rejectedHits.push({ playerId: occ.playerId, playerName, timestamp: occ.timestamp, reason: 'diedBeforeOccurrence' })
      continue
    }
    if (!eligiblePlayerIds.has(occ.playerId)) {
      rejectedHits.push({ playerId: occ.playerId, playerName, timestamp: occ.timestamp, reason: 'notEligible' })
      continue
    }
    acceptedOccurrences.push(occ)
  }

  const acceptedHitPlayerIds = [...new Set(acceptedOccurrences.map((o) => o.playerId))]
  const hitPlayers = acceptedHitPlayerIds.map(toRef).filter((ref): ref is PullMechanicPlayerRef => ref !== null)

  const acceptedTimestamps = acceptedOccurrences.map((o) => o.timestamp)
  const firstHit = acceptedTimestamps.length > 0 ? Math.min(...acceptedTimestamps) : null

  return {
    reportCode: fight.reportCode,
    reportTitle: fight.reportTitle,
    fightId: fight.fightId,
    pullNumber: fight.pullNumber,
    pullTimestampMs: fight.reportStartTime + fight.fightStartTime,
    raidDate: computeRaidDate(fight.reportStartTime + fight.fightStartTime, timezone),
    kill: fight.kill,
    bossPercentage: fight.bossPercentage,
    fightDurationMs: fight.durationMs,
    phaseOneEndMs: fight.phaseOneEndFightRelativeMs,
    phaseBoundarySource: fight.phaseBoundarySource,
    mechanicKey: mechanic.key,
    mechanicLabel: mechanic.label,
    mechanicOccurred,
    mechanicOccurrenceQuality,
    eligiblePlayers,
    hitPlayers,
    dedupedOccurrences: acceptedOccurrences,
    rejectedHits,
    firstHitFightRelativeMs: firstHit !== null ? firstHit - fight.fightStartTime : null,
    isDuplicate: fight.isDuplicate,
    duplicateGroupId: fight.duplicateGroupId,
    canonicalReportCode: fight.canonicalReportCode,
  }
}

// ---------------------------------------------------------------------------
// Player x mechanic summaries (player-summary.csv)
// ---------------------------------------------------------------------------

export const buildPlayerMechanicSummaries = (params: {
  pullRecords: PullMechanicRecord[]
  thresholds: MechanicAuditThresholds
}): MechanicAuditPlayerMechanicSummary[] => {
  const mechanicKeys = [...new Set(params.pullRecords.map((r) => r.mechanicKey))]
  const summaries: MechanicAuditPlayerMechanicSummary[] = []

  for (const mechanicKey of mechanicKeys) {
    const mechanicRecords = params.pullRecords.filter((r) => r.mechanicKey === mechanicKey)
    const mechanicLabel = mechanicRecords[0]?.mechanicLabel ?? mechanicKey

    const playersByNormalizedName = new Map<string, PullMechanicPlayerRef>()
    for (const record of mechanicRecords) {
      for (const ref of record.eligiblePlayers) {
        if (!playersByNormalizedName.has(ref.normalizedName)) playersByNormalizedName.set(ref.normalizedName, ref)
      }
    }

    type RawPlayerStats = {
      ref: PullMechanicPlayerRef
      eligiblePulls: number
      hitPulls: number
      deduplicatedHitOccurrences: number
      raidNightsPresent: Set<string>
      raidNightsWithFailure: Set<string>
      chronological: Array<{ pullTimestampMs: number; hit: boolean }>
    }
    const rawByName = new Map<string, RawPlayerStats>()
    for (const [normalizedName, ref] of playersByNormalizedName) {
      rawByName.set(normalizedName, {
        ref,
        eligiblePulls: 0,
        hitPulls: 0,
        deduplicatedHitOccurrences: 0,
        raidNightsPresent: new Set(),
        raidNightsWithFailure: new Set(),
        chronological: [],
      })
    }

    for (const record of mechanicRecords) {
      const hitRefById = new Map(record.hitPlayers.map((r) => [r.playerId, r]))
      const eligibleNames = new Set(record.eligiblePlayers.map((r) => r.normalizedName))
      const hitNamesThisPull = new Set(record.hitPlayers.map((r) => r.normalizedName))

      for (const normalizedName of eligibleNames) {
        const raw = rawByName.get(normalizedName)
        if (!raw) continue
        raw.eligiblePulls += 1
        raw.raidNightsPresent.add(record.raidDate)
        const isHit = hitNamesThisPull.has(normalizedName)
        if (isHit) {
          raw.hitPulls += 1
          raw.raidNightsWithFailure.add(record.raidDate)
        }
        raw.chronological.push({ pullTimestampMs: record.pullTimestampMs, hit: isHit })
      }

      for (const occ of record.dedupedOccurrences) {
        const ref = hitRefById.get(occ.playerId)
        if (!ref) continue
        const raw = rawByName.get(ref.normalizedName)
        if (raw) raw.deduplicatedHitOccurrences += 1
      }
    }

    const totalHitPulls = [...rawByName.values()].reduce((sum, r) => sum + r.hitPulls, 0)
    const totalEligiblePulls = [...rawByName.values()].reduce((sum, r) => sum + r.eligiblePulls, 0)
    const guildAverageHitPullRate = totalEligiblePulls > 0 ? totalHitPulls / totalEligiblePulls : 0

    for (const raw of rawByName.values()) {
      const hitPullRate = raw.eligiblePulls > 0 ? raw.hitPulls / raw.eligiblePulls : 0
      const last30 = [...raw.chronological].sort((a, b) => b.pullTimestampMs - a.pullTimestampMs).slice(0, 30)
      const last30EligiblePulls = last30.length
      const last30HitPulls = last30.filter((p) => p.hit).length
      const last30HitPullRate = last30EligiblePulls > 0 ? last30HitPulls / last30EligiblePulls : 0

      const reviewCandidate =
        raw.eligiblePulls >= params.thresholds.minimumEligiblePulls &&
        raw.raidNightsWithFailure.size >= params.thresholds.minimumRaidNightsWithFailure &&
        hitPullRate >= guildAverageHitPullRate * params.thresholds.guildAverageMultiplier &&
        hitPullRate >= guildAverageHitPullRate + params.thresholds.minimumAbsoluteRateDelta

      summaries.push({
        playerName: raw.ref.playerName,
        playerClass: raw.ref.playerClass ?? null,
        mechanicKey,
        mechanicLabel,
        eligiblePulls: raw.eligiblePulls,
        hitPulls: raw.hitPulls,
        deduplicatedHitOccurrences: raw.deduplicatedHitOccurrences,
        hitPullRate,
        raidNightsPresent: raw.raidNightsPresent.size,
        raidNightsWithFailure: raw.raidNightsWithFailure.size,
        last30EligiblePulls,
        last30HitPulls,
        last30HitPullRate,
        guildAverageHitPullRate,
        playerRateMinusGuildAverage: hitPullRate - guildAverageHitPullRate,
        playerRateDividedByGuildAverage: guildAverageHitPullRate > 0 ? hitPullRate / guildAverageHitPullRate : 0,
        reviewCandidate,
      })
    }
  }

  return summaries
}

// ---------------------------------------------------------------------------
// Distributed vs. concentrated classification
// ---------------------------------------------------------------------------

const median = (sortedValues: number[]): number => {
  if (sortedValues.length === 0) return 0
  const mid = Math.floor(sortedValues.length / 2)
  return sortedValues.length % 2 === 0 ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 : sortedValues[mid]
}

/** Below this share of matched fights actually being usable, a sample is too selective to trust even if raw pull/player counts look adequate. */
export const MINIMUM_INCLUDED_FIGHT_PERCENT = 50

export type MechanicDistributionMetrics = {
  eligiblePulls: number
  eligiblePlayers: number
  topThreePlayersHitShare: number
  reviewCandidateShareOfHitPulls: number
  shareOfEligiblePlayersWithHit: number
  matchedFights: number
  includedFightPercent: number
}

/**
 * Single pure rule, kept isolated so officers can inspect/disagree with it and so it
 * can be unit-tested independently of the rest of the aggregation pipeline.
 */
export const classifyMechanicDistribution = (metrics: MechanicDistributionMetrics): MechanicDistributionClassification => {
  if (metrics.eligiblePulls < 10 || metrics.eligiblePlayers < 8) return 'insufficientData'
  if (metrics.matchedFights > 0 && metrics.includedFightPercent < MINIMUM_INCLUDED_FIGHT_PERCENT) return 'insufficientData'
  if (metrics.topThreePlayersHitShare >= 0.6 || metrics.reviewCandidateShareOfHitPulls >= 0.6) return 'concentrated'
  if (metrics.topThreePlayersHitShare < 0.4 && metrics.shareOfEligiblePlayersWithHit >= 0.5) return 'distributed'
  return 'mixed'
}

const buildClassificationSummaryText = (
  mechanicLabel: string,
  classification: MechanicDistributionClassification,
  metrics: { topThreePlayersHitShare: number }
): string => {
  switch (classification) {
    case 'distributed':
      return `${mechanicLabel} failures appear distributed across the roster in this sample.`
    case 'concentrated':
      return `${mechanicLabel} failures in this sample are concentrated, with the top three players accounting for ${Math.round(metrics.topThreePlayersHitShare * 100)}% of hit-pulls.`
    case 'mixed':
      return `${mechanicLabel} failures show a mixed pattern in this sample — some concentration, but not enough to call it clearly concentrated or distributed.`
    case 'insufficientData':
      return `There is not yet enough sample data to classify ${mechanicLabel} failures as distributed or concentrated.`
  }
}

export const buildMechanicSummary = (params: {
  mechanicKey: string
  mechanicLabel: string
  playerSummaries: MechanicAuditPlayerMechanicSummary[]
  thresholds: MechanicAuditThresholds
  matchedFights: number
  includedFights: number
  pullsWithEligiblePlayer: number
}): MechanicAuditMechanicSummary => {
  const eligible = params.playerSummaries.filter((p) => p.eligiblePulls > 0)
  const totalHitPulls = eligible.reduce((sum, p) => sum + p.hitPulls, 0)
  const playersEligible = eligible.length
  const playersWithAtLeastOneHit = eligible.filter((p) => p.hitPulls > 0).length
  const shareOfEligiblePlayersWithHit = playersEligible > 0 ? playersWithAtLeastOneHit / playersEligible : 0

  const sortedByHits = [...eligible].sort((a, b) => b.hitPulls - a.hitPulls)
  const topThreeHits = sortedByHits.slice(0, 3).reduce((sum, p) => sum + p.hitPulls, 0)
  const topThreePlayersHitShare = totalHitPulls > 0 ? topThreeHits / totalHitPulls : 0

  const totalEligiblePulls = eligible.reduce((sum, p) => sum + p.eligiblePulls, 0)
  const guildAverageHitPullRate = totalEligiblePulls > 0 ? totalHitPulls / totalEligiblePulls : 0
  const medianPlayerHitPullRate = median([...eligible.map((p) => p.hitPullRate)].sort((a, b) => a - b))

  const reviewCandidates = eligible.filter((p) => p.reviewCandidate)
  const reviewCandidateCount = reviewCandidates.length
  const reviewCandidateHitPulls = reviewCandidates.reduce((sum, p) => sum + p.hitPulls, 0)
  const reviewCandidateShareOfHitPulls = totalHitPulls > 0 ? reviewCandidateHitPulls / totalHitPulls : 0

  const excludedFights = Math.max(0, params.matchedFights - params.includedFights)
  const includedFightPercent = params.matchedFights > 0 ? (params.includedFights / params.matchedFights) * 100 : 0
  const eligiblePullCoverage = params.includedFights > 0 ? params.pullsWithEligiblePlayer / params.includedFights : 0

  const classification = classifyMechanicDistribution({
    eligiblePulls: totalEligiblePulls,
    eligiblePlayers: playersEligible,
    topThreePlayersHitShare,
    reviewCandidateShareOfHitPulls,
    shareOfEligiblePlayersWithHit,
    matchedFights: params.matchedFights,
    includedFightPercent,
  })

  const maxEligiblePulls = eligible.length > 0 ? Math.max(...eligible.map((p) => p.eligiblePulls)) : 0
  const reviewCandidateEvaluationNote =
    maxEligiblePulls < params.thresholds.minimumEligiblePulls
      ? `Review-candidate evaluation unavailable: maximum eligible pulls was ${maxEligiblePulls}; configured minimum was ${params.thresholds.minimumEligiblePulls}.`
      : undefined

  return {
    mechanicKey: params.mechanicKey,
    mechanicLabel: params.mechanicLabel,
    totalHitPulls,
    playersEligible,
    playersWithAtLeastOneHit,
    shareOfEligiblePlayersWithHit,
    topThreePlayersHitShare,
    guildAverageHitPullRate,
    medianPlayerHitPullRate,
    reviewCandidateCount,
    classification,
    summaryText: buildClassificationSummaryText(params.mechanicLabel, classification, { topThreePlayersHitShare }),
    matchedFights: params.matchedFights,
    includedFights: params.includedFights,
    excludedFights,
    includedFightPercent,
    eligiblePullCoverage,
    reviewCandidateEvaluationNote,
  }
}
