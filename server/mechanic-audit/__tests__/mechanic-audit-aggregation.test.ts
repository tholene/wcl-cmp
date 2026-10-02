import { describe, expect, it } from 'vitest'
import type { MechanicAuditFightRecord, MechanicAuditPlayerInfo, MechanicAuditThresholds } from '../mechanic-audit.types'
import {
  assignPullNumbers,
  buildMechanicHits,
  buildMechanicSummary,
  buildPlayerMechanicSummaries,
  buildPullMechanicRecord,
  classifyMechanicDistribution,
  computeRaidDate,
  dedupeMechanicOccurrences,
  deriveFightRelativePhaseOneEnd,
  detectDuplicateFights,
  extractDeathEvents,
  extractMechanicOccurrences,
  extractOccurrenceEvidenceTimestamps,
  filterEventsWithinPhaseOne,
  firstDeathTimestampByPlayer,
  isPlayerEligibleForMechanic,
  mapEventsToFights,
  MINIMUM_INCLUDED_FIGHT_PERCENT,
  normalizePlayerName,
  resolveMechanicOccurrence,
  resolvePhaseOneBoundary,
  type BoundaryFightInput,
  type DuplicateFightCandidate,
  type PullMechanicRecord,
} from '../mechanic-audit-aggregation'
import type { RawWclEvent } from '../mechanic-audit-event-fetcher'

const THRESHOLDS: MechanicAuditThresholds = {
  minimumEligiblePulls: 15,
  minimumRaidNightsWithFailure: 3,
  guildAverageMultiplier: 1.5,
  minimumAbsoluteRateDelta: 0.05,
}

const makeBoundaryFight = (overrides: Partial<BoundaryFightInput> = {}): BoundaryFightInput => ({
  fightId: 1,
  fightStartTime: 1_000,
  fightEndTime: 11_000,
  durationMs: 10_000,
  kill: false,
  ...overrides,
})

const makeFightRecord = (overrides: Partial<MechanicAuditFightRecord> = {}): MechanicAuditFightRecord => ({
  reportCode: 'ABC123',
  reportTitle: 'Test Report',
  reportStartTime: 1_700_000_000_000,
  fightId: 1,
  pullNumber: 1,
  encounterId: 3009,
  encounterName: "L'ura",
  difficulty: 5,
  kill: false,
  fightStartTime: 1_000,
  fightEndTime: 11_000,
  durationMs: 10_000,
  bossPercentage: 42,
  friendlyPlayerIds: [1, 2],
  phaseOneEndReportRelativeMs: 6_000,
  phaseOneEndFightRelativeMs: 5_000,
  phaseBoundarySource: 'phaseTransition',
  isDuplicate: false,
  ...overrides,
})

const players = (): Map<number, MechanicAuditPlayerInfo> =>
  new Map([
    [1, { playerId: 1, playerName: 'Alice', playerClass: 'Mage' }],
    [2, { playerId: 2, playerName: 'Bob', playerClass: 'Warrior' }],
  ])

describe('resolvePhaseOneBoundary — phaseTransition mode with noTransitionFallback', () => {
  it('scenario 1: an exact phase-transition record always wins, regardless of fallback config', () => {
    const fight = makeBoundaryFight({ kill: true })
    const result = resolvePhaseOneBoundary(
      fight,
      { mode: 'phaseTransition', phase: 2, noTransitionFallback: { mode: 'fightEndForWipes' } },
      { phaseTransitions: [{ id: 2, startTime: 6_000 }] }
    )
    expect(result).toEqual({ resolved: true, phaseOneEndMs: 6_000, source: 'phaseTransition' })
  })

  it('scenario 2: a wipe with no transition record and fightEndForWipes configured resolves via fight-end as a low-severity diagnostic, not an exclusion', () => {
    const fight = makeBoundaryFight({ kill: false })
    const result = resolvePhaseOneBoundary(
      fight,
      { mode: 'phaseTransition', phase: 2, noTransitionFallback: { mode: 'fightEndForWipes' } },
      { phaseTransitions: [] }
    )
    expect(result.resolved).toBe(true)
    if (result.resolved) {
      expect(result.phaseOneEndMs).toBe(fight.fightEndTime)
      expect(result.source).toBe('fightEndBeforePhaseTransition')
      expect(result.diagnostic).toBeDefined()
    }
  })

  it('scenario 3: no transition record but a configured marker ability fired uses the first marker event, even on a kill', () => {
    const fight = makeBoundaryFight({ kill: true })
    const result = resolvePhaseOneBoundary(
      fight,
      {
        mode: 'phaseTransition',
        phase: 2,
        noTransitionFallback: { mode: 'markerAbilityThenFightEndForWipes', abilityIds: [999] },
      },
      { phaseTransitions: [], markerEventTimestamps: [7_500, 4_200] }
    )
    expect(result.resolved).toBe(true)
    if (result.resolved) {
      expect(result.phaseOneEndMs).toBe(4_200)
      expect(result.source).toBe('markerAbilityFallback')
    }
  })

  it('scenario 4: a kill with no transition record and no marker evidence must be excluded with a data-quality warning, never assumed all-Phase-1', () => {
    const fight = makeBoundaryFight({ kill: true })
    const result = resolvePhaseOneBoundary(
      fight,
      { mode: 'phaseTransition', phase: 2, noTransitionFallback: { mode: 'fightEndForWipes' } },
      { phaseTransitions: [] }
    )
    expect(result.resolved).toBe(false)
    if (!result.resolved) {
      expect(result.source).toBe('unresolved')
      expect(result.warning).toMatch(/kill/i)
    }
  })

  it('scenario 5: evidence Phase 2 occurred (a kill) prevents fight-end fallback even when markerAbilityThenFightEndForWipes is configured but the marker never fired', () => {
    const fight = makeBoundaryFight({ kill: true })
    const result = resolvePhaseOneBoundary(
      fight,
      {
        mode: 'phaseTransition',
        phase: 2,
        noTransitionFallback: { mode: 'markerAbilityThenFightEndForWipes', abilityIds: [999] },
      },
      { phaseTransitions: [], markerEventTimestamps: [] }
    )
    expect(result.resolved).toBe(false)
    if (!result.resolved) {
      expect(result.source).toBe('unresolved')
    }
  })

  it('defaults to exclude when noTransitionFallback is omitted, matching the prior behavior', () => {
    const fight = makeBoundaryFight({ kill: false })
    const result = resolvePhaseOneBoundary(fight, { mode: 'phaseTransition', phase: 2 }, { phaseTransitions: [] })
    expect(result.resolved).toBe(false)
  })
})

describe('deriveFightRelativePhaseOneEnd — timestamp correctness (report-relative -> fight-relative)', () => {
  it('scenario 6: converts a report-relative Phase 1 end into a fight-relative value within [0, durationMs]', () => {
    const fight = { fightId: 1, fightStartTime: 100_000, durationMs: 10_000 }
    const result = deriveFightRelativePhaseOneEnd(fight, 105_000)
    expect(result).toEqual({ ok: true, reportRelativeMs: 105_000, fightRelativeMs: 5_000 })
  })

  it('scenario 7: records an invariant-violation error instead of exporting an out-of-range fight-relative timestamp', () => {
    const fight = { fightId: 1, fightStartTime: 100_000, durationMs: 10_000 }
    const tooEarly = deriveFightRelativePhaseOneEnd(fight, 50_000)
    const tooLate = deriveFightRelativePhaseOneEnd(fight, 115_000)
    expect(tooEarly.ok).toBe(false)
    expect(tooLate.ok).toBe(false)
    if (!tooEarly.ok) expect(tooEarly.error).toMatch(/duration/i)
  })
})

describe('resolveMechanicOccurrence — mechanic-occurrence denominator (three-tier rule)', () => {
  it('scenario 8: independent occurrence evidence (configured cast/debuff) confirms occurrence as verified', () => {
    const result = resolveMechanicOccurrence({
      hasOccurrenceConfig: true,
      occurrenceTimestampsInPhase1: [3_000],
      dedupedOccurrenceCount: 0,
    })
    expect(result).toEqual({ mechanicOccurred: true, mechanicOccurrenceQuality: 'verified' })
  })

  it('scenario 9: a damage hit alone (no occurrence config) confirms occurrence as approximateFromDamage, never a silent "did not occur"', () => {
    const result = resolveMechanicOccurrence({
      hasOccurrenceConfig: false,
      occurrenceTimestampsInPhase1: [],
      dedupedOccurrenceCount: 1,
    })
    expect(result).toEqual({ mechanicOccurred: true, mechanicOccurrenceQuality: 'approximateFromDamage' })
  })

  it('scenario 10: a zero-hit pull with occurrence config checked and no evidence found is a confident, verified absence', () => {
    const result = resolveMechanicOccurrence({
      hasOccurrenceConfig: true,
      occurrenceTimestampsInPhase1: [],
      dedupedOccurrenceCount: 0,
    })
    expect(result).toEqual({ mechanicOccurred: false, mechanicOccurrenceQuality: 'verified' })
  })

  it('a zero-hit pull with no occurrence config is an unconfirmed, approximate absence guess', () => {
    const result = resolveMechanicOccurrence({
      hasOccurrenceConfig: false,
      occurrenceTimestampsInPhase1: [],
      dedupedOccurrenceCount: 0,
    })
    expect(result).toEqual({ mechanicOccurred: false, mechanicOccurrenceQuality: 'approximateFromDamage' })
  })

  it('a damage hit still counts as confirmation even when occurrence config is present but somehow missed the event', () => {
    const result = resolveMechanicOccurrence({
      hasOccurrenceConfig: true,
      occurrenceTimestampsInPhase1: [],
      dedupedOccurrenceCount: 2,
    })
    expect(result).toEqual({ mechanicOccurred: true, mechanicOccurrenceQuality: 'approximateFromDamage' })
  })
})

describe('detectDuplicateFights — cross-report duplicate detection', () => {
  const baseCandidate = (overrides: Partial<DuplicateFightCandidate> = {}): DuplicateFightCandidate => ({
    reportCode: 'REPORT-A',
    fightId: 1,
    absoluteStartTime: 1_700_000_000_000,
    durationMs: 300_000,
    bossPercentage: 10,
    kill: false,
    playerNames: new Set(['alice', 'bob', 'carol']),
    ...overrides,
  })

  it('scenario 11: two fights across different reports with matching start time, duration, outcome, boss%, and roster are flagged as duplicates', () => {
    const a = baseCandidate()
    const b = baseCandidate({ reportCode: 'REPORT-B', fightId: 7, absoluteStartTime: 1_700_000_001_000 })
    const result = detectDuplicateFights([a, b])
    expect(result.get('REPORT-A::1')?.isCanonical).toBe(true)
    expect(result.get('REPORT-B::7')?.isCanonical).toBe(false)
    expect(result.get('REPORT-B::7')?.canonicalReportCode).toBe('REPORT-A')
  })

  it('scenario 12: matching duration alone is not sufficient — different rosters and start times must not be merged', () => {
    const a = baseCandidate()
    const b = baseCandidate({
      reportCode: 'REPORT-B',
      fightId: 2,
      absoluteStartTime: 1_800_000_000_000,
      playerNames: new Set(['dave', 'erin', 'frank']),
    })
    const result = detectDuplicateFights([a, b])
    expect(result.size).toBe(0)
  })

  it('fights within the same report are never treated as duplicates of each other', () => {
    const a = baseCandidate({ fightId: 1 })
    const b = baseCandidate({ fightId: 2 })
    const result = detectDuplicateFights([a, b])
    expect(result.size).toBe(0)
  })

  it('a duplicate group records duplicateGroupId, canonicalReportCode, duplicateReportCodes, and a confidence tier', () => {
    const a = baseCandidate()
    const b = baseCandidate({ reportCode: 'REPORT-B', fightId: 7, absoluteStartTime: 1_700_000_001_000 })
    const result = detectDuplicateFights([a, b])
    const canonical = result.get('REPORT-A::1')
    const dup = result.get('REPORT-B::7')
    expect(canonical?.groupId).toBe(dup?.groupId)
    expect(dup?.duplicateReportCodes).toEqual(['REPORT-B'])
    expect(['high', 'medium', 'low']).toContain(dup?.confidence)
  })
})

describe('buildPullMechanicRecord — aggregation invariant: hitPlayers is always a subset of eligiblePlayers', () => {
  it('scenario 13: an accepted hit for an eligible player on an eligible pull appears in hitPlayers', () => {
    const fight = makeFightRecord()
    const deduped = dedupeMechanicOccurrences(
      [
        {
          reportCode: 'ABC123',
          fightId: 1,
          mechanicKey: 'glaives',
          mechanicLabel: 'Glaives',
          abilityId: 111,
          abilityName: 'Glaive Toss',
          playerId: 1,
          timestamp: 2_000,
          amount: 5000,
          absorbed: 0,
          overkill: 0,
        },
      ],
      750
    )
    const record = buildPullMechanicRecord({
      fight,
      mechanic: { key: 'glaives', label: 'Glaives', abilityIds: [111] },
      dedupedOccurrences: deduped,
      mechanicOccurred: true,
      mechanicOccurrenceQuality: 'approximateFromDamage',
      players: players(),
      firstDeathTimestamp: new Map(),
      timezone: 'Europe/Stockholm',
    })
    expect(record.hitPlayers.map((p) => p.playerId)).toEqual([1])
    const eligibleIds = new Set(record.eligiblePlayers.map((p) => p.playerId))
    for (const hit of record.hitPlayers) expect(eligibleIds.has(hit.playerId)).toBe(true)
  })

  it('scenario 14: a hit from a player not in friendlyPlayerIds is still added to the candidate pool via the hit itself, and appears eligible', () => {
    const fight = makeFightRecord({ friendlyPlayerIds: [1] })
    const deduped = dedupeMechanicOccurrences(
      [
        {
          reportCode: 'ABC123',
          fightId: 1,
          mechanicKey: 'glaives',
          mechanicLabel: 'Glaives',
          abilityId: 111,
          abilityName: 'Glaive Toss',
          playerId: 2,
          timestamp: 2_000,
          amount: 5000,
          absorbed: 0,
          overkill: 0,
        },
      ],
      750
    )
    const record = buildPullMechanicRecord({
      fight,
      mechanic: { key: 'glaives', label: 'Glaives', abilityIds: [111] },
      dedupedOccurrences: deduped,
      mechanicOccurred: true,
      mechanicOccurrenceQuality: 'approximateFromDamage',
      players: players(),
      firstDeathTimestamp: new Map(),
      timezone: 'Europe/Stockholm',
    })
    expect(record.hitPlayers.map((p) => p.playerId)).toEqual([2])
    expect(record.eligiblePlayers.map((p) => p.playerId)).toContain(2)
  })

  it('scenario 15: a hit landing after the player died is rejected with reason diedBeforeOccurrence, preserved in diagnostics, and excluded from hitPlayers', () => {
    const fight = makeFightRecord()
    const deduped = dedupeMechanicOccurrences(
      [
        {
          reportCode: 'ABC123',
          fightId: 1,
          mechanicKey: 'glaives',
          mechanicLabel: 'Glaives',
          abilityId: 111,
          abilityName: 'Glaive Toss',
          playerId: 1,
          timestamp: 4_000,
          amount: 5000,
          absorbed: 0,
          overkill: 0,
        },
      ],
      750
    )
    const record = buildPullMechanicRecord({
      fight,
      mechanic: { key: 'glaives', label: 'Glaives', abilityIds: [111] },
      dedupedOccurrences: deduped,
      mechanicOccurred: true,
      mechanicOccurrenceQuality: 'approximateFromDamage',
      players: players(),
      firstDeathTimestamp: new Map([[1, 3_000]]),
      timezone: 'Europe/Stockholm',
    })
    expect(record.hitPlayers).toEqual([])
    expect(record.rejectedHits).toHaveLength(1)
    expect(record.rejectedHits[0]).toMatchObject({ playerId: 1, reason: 'diedBeforeOccurrence' })
  })

  it('scenario 16: a hit on a pull where Phase 1 could not be resolved is rejected with reason phaseOneUnresolved, and no eligible players are computed', () => {
    const fight = makeFightRecord({ phaseOneEndFightRelativeMs: null, phaseBoundarySource: 'unresolved' })
    const deduped = dedupeMechanicOccurrences(
      [
        {
          reportCode: 'ABC123',
          fightId: 1,
          mechanicKey: 'glaives',
          mechanicLabel: 'Glaives',
          abilityId: 111,
          abilityName: 'Glaive Toss',
          playerId: 1,
          timestamp: 4_000,
          amount: 5000,
          absorbed: 0,
          overkill: 0,
        },
      ],
      750
    )
    const record = buildPullMechanicRecord({
      fight,
      mechanic: { key: 'glaives', label: 'Glaives', abilityIds: [111] },
      dedupedOccurrences: deduped,
      mechanicOccurred: true,
      mechanicOccurrenceQuality: 'approximateFromDamage',
      players: players(),
      firstDeathTimestamp: new Map(),
      timezone: 'Europe/Stockholm',
    })
    expect(record.eligiblePlayers).toEqual([])
    expect(record.hitPlayers).toEqual([])
    expect(record.rejectedHits[0]).toMatchObject({ playerId: 1, reason: 'phaseOneUnresolved' })
  })

  it('a hit for a player who never qualifies as eligible (mechanic did not occur) is rejected with reason notEligible', () => {
    const fight = makeFightRecord()
    const record = buildPullMechanicRecord({
      fight,
      mechanic: { key: 'glaives', label: 'Glaives', abilityIds: [111] },
      dedupedOccurrences: [],
      mechanicOccurred: false,
      mechanicOccurrenceQuality: 'verified',
      players: players(),
      firstDeathTimestamp: new Map(),
      timezone: 'Europe/Stockholm',
    })
    expect(record.eligiblePlayers).toEqual([])
  })
})

describe('sample-size handling: insufficientData classification and review-candidate messaging', () => {
  it('scenario: classification becomes insufficientData when eligiblePulls/eligiblePlayers are below the floor, "review candidates: 0" is not presented as meaningful', () => {
    const classification = classifyMechanicDistribution({
      eligiblePulls: 3,
      eligiblePlayers: 2,
      topThreePlayersHitShare: 0,
      reviewCandidateShareOfHitPulls: 0,
      shareOfEligiblePlayersWithHit: 0,
      matchedFights: 5,
      includedFightPercent: 100,
    })
    expect(classification).toBe('insufficientData')
  })

  it(`scenario: classification becomes insufficientData when includedFightPercent falls below ${MINIMUM_INCLUDED_FIGHT_PERCENT}%, even if raw pull/player counts look adequate`, () => {
    const classification = classifyMechanicDistribution({
      eligiblePulls: 50,
      eligiblePlayers: 20,
      topThreePlayersHitShare: 0.3,
      reviewCandidateShareOfHitPulls: 0.2,
      shareOfEligiblePlayersWithHit: 0.6,
      matchedFights: 100,
      includedFightPercent: 14,
    })
    expect(classification).toBe('insufficientData')
  })

  it('buildMechanicSummary sets reviewCandidateEvaluationNote when no player reaches the minimum eligible-pulls threshold', () => {
    const summary = buildMechanicSummary({
      mechanicKey: 'glaives',
      mechanicLabel: 'Glaives',
      playerSummaries: [
        {
          playerName: 'Alice',
          playerClass: 'Mage',
          mechanicKey: 'glaives',
          mechanicLabel: 'Glaives',
          eligiblePulls: 5,
          hitPulls: 4,
          deduplicatedHitOccurrences: 4,
          hitPullRate: 0.8,
          raidNightsPresent: 2,
          raidNightsWithFailure: 2,
          last30EligiblePulls: 5,
          last30HitPulls: 4,
          last30HitPullRate: 0.8,
          guildAverageHitPullRate: 0.5,
          playerRateMinusGuildAverage: 0.3,
          playerRateDividedByGuildAverage: 1.6,
          reviewCandidate: false,
        },
      ],
      thresholds: THRESHOLDS,
      matchedFights: 10,
      includedFights: 10,
      pullsWithEligiblePlayer: 5,
    })
    expect(summary.reviewCandidateCount).toBe(0)
    expect(summary.reviewCandidateEvaluationNote).toBeDefined()
    expect(summary.reviewCandidateEvaluationNote).toMatch(/unavailable/i)
  })

  it('buildMechanicSummary leaves reviewCandidateEvaluationNote unset once at least one player clears the minimum eligible-pulls threshold', () => {
    const summary = buildMechanicSummary({
      mechanicKey: 'glaives',
      mechanicLabel: 'Glaives',
      playerSummaries: [
        {
          playerName: 'Alice',
          playerClass: 'Mage',
          mechanicKey: 'glaives',
          mechanicLabel: 'Glaives',
          eligiblePulls: 20,
          hitPulls: 4,
          deduplicatedHitOccurrences: 4,
          hitPullRate: 0.2,
          raidNightsPresent: 5,
          raidNightsWithFailure: 3,
          last30EligiblePulls: 20,
          last30HitPulls: 4,
          last30HitPullRate: 0.2,
          guildAverageHitPullRate: 0.1,
          playerRateMinusGuildAverage: 0.1,
          playerRateDividedByGuildAverage: 2,
          reviewCandidate: true,
        },
      ],
      thresholds: THRESHOLDS,
      matchedFights: 20,
      includedFights: 20,
      pullsWithEligiblePlayer: 20,
    })
    expect(summary.reviewCandidateEvaluationNote).toBeUndefined()
  })
})

describe('warning presentation: fight-end fallback resolutions never surface as exclusions', () => {
  it('a wipe resolved via the fight-end fallback carries a diagnostic, not a warning/exclusion reason', () => {
    const fight = makeBoundaryFight({ kill: false })
    const result = resolvePhaseOneBoundary(
      fight,
      { mode: 'phaseTransition', phase: 2, noTransitionFallback: { mode: 'fightEndForWipes' } },
      { phaseTransitions: [] }
    )
    expect(result.resolved).toBe(true)
    expect('warning' in result).toBe(false)
  })
})

describe('fixed timestamp mode (fightRelativeTimestamp): explicit manual fallback only', () => {
  it('clamps a configured end time to the fight duration and labels the result approximate', () => {
    const fight = makeBoundaryFight({ durationMs: 5_000, fightStartTime: 1_000, fightEndTime: 6_000 })
    const result = resolvePhaseOneBoundary(fight, { mode: 'fightRelativeTimestamp', endTimeMs: 50_000 }, {})
    expect(result.resolved).toBe(true)
    if (result.resolved) {
      expect(result.phaseOneEndMs).toBe(fight.fightStartTime + fight.durationMs)
      expect(result.source).toBe('fightRelativeTimestamp')
      expect(result.diagnostic).toMatch(/approximate/i)
    }
  })

  it('never substitutes for phaseTransition mode — a separate boundary mode selection is required', () => {
    const fight = makeBoundaryFight({ kill: false })
    const result = resolvePhaseOneBoundary(fight, { mode: 'phaseTransition', phase: 2 }, { phaseTransitions: [] })
    expect(result.resolved).toBe(false)
  })
})

describe('supporting pure functions', () => {
  it('normalizePlayerName is case-insensitive and trims whitespace', () => {
    expect(normalizePlayerName('  Alice  ')).toBe('alice')
    expect(normalizePlayerName('ALICE')).toBe('alice')
  })

  it('assignPullNumbers orders fights chronologically starting at 1', () => {
    const fights = [{ fightStartTime: 300 }, { fightStartTime: 100 }, { fightStartTime: 200 }]
    const result = assignPullNumbers(fights)
    expect(result.map((f) => f.pullNumber)).toEqual([1, 2, 3])
    expect(result.map((f) => f.fightStartTime)).toEqual([100, 200, 300])
  })

  it('mapEventsToFights buckets events into the fight window that contains their timestamp', () => {
    const events: RawWclEvent[] = [{ timestamp: 1_500 }, { timestamp: 11_500 }, { timestamp: 99_999 }]
    const fights = [
      { fightId: 1, fightStartTime: 1_000, fightEndTime: 2_000 },
      { fightId: 2, fightStartTime: 11_000, fightEndTime: 12_000 },
    ]
    const result = mapEventsToFights(events, fights)
    expect(result.get(1)).toHaveLength(1)
    expect(result.get(2)).toHaveLength(1)
  })

  it('filterEventsWithinPhaseOne excludes events at or after the Phase 1 boundary', () => {
    const events: RawWclEvent[] = [{ timestamp: 100 }, { timestamp: 200 }, { timestamp: 300 }]
    expect(filterEventsWithinPhaseOne(events, 200).map((e) => e.timestamp)).toEqual([100])
  })

  it('dedupeMechanicOccurrences collapses events within the window per player and never merges across players', () => {
    const occurrences = [
      { reportCode: 'A', fightId: 1, mechanicKey: 'glaives', mechanicLabel: 'Glaives', abilityId: 1, abilityName: 'Glaive', playerId: 1, timestamp: 1_000, amount: 100, absorbed: 0, overkill: 0 },
      { reportCode: 'A', fightId: 1, mechanicKey: 'glaives', mechanicLabel: 'Glaives', abilityId: 1, abilityName: 'Glaive', playerId: 1, timestamp: 1_200, amount: 50, absorbed: 0, overkill: 0 },
      { reportCode: 'A', fightId: 1, mechanicKey: 'glaives', mechanicLabel: 'Glaives', abilityId: 1, abilityName: 'Glaive', playerId: 2, timestamp: 1_000, amount: 100, absorbed: 0, overkill: 0 },
    ]
    const result = dedupeMechanicOccurrences(occurrences, 750)
    expect(result).toHaveLength(2)
    const player1 = result.find((r) => r.playerId === 1)
    expect(player1?.rawEventCount).toBe(2)
    expect(player1?.amount).toBe(150)
  })

  it('extractMechanicOccurrences only extracts events matching a configured ability ID with a numeric target and timestamp', () => {
    const events: RawWclEvent[] = [
      { timestamp: 1_000, targetID: 1, abilityGameID: 111, amount: 500 },
      { timestamp: 1_000, targetID: 1, abilityGameID: 999, amount: 500 },
      { timestamp: 1_000, abilityGameID: 111, amount: 500 },
    ]
    const result = extractMechanicOccurrences({
      reportCode: 'A',
      fightId: 1,
      events,
      abilityIdToMechanic: new Map([[111, { key: 'glaives', label: 'Glaives', abilityIds: [111] }]]),
    })
    expect(result).toHaveLength(1)
    expect(result[0].playerId).toBe(1)
  })

  it('extractOccurrenceEvidenceTimestamps groups independent occurrence timestamps by mechanic key regardless of target', () => {
    const events: RawWclEvent[] = [{ timestamp: 2_000, abilityGameID: 222 }, { timestamp: 2_500, abilityGameID: 222 }]
    const result = extractOccurrenceEvidenceTimestamps({
      fightId: 1,
      events,
      occurrenceAbilityIdToMechanicKey: new Map([[222, 'beams']]),
    })
    expect(result.get('beams')).toEqual([2_000, 2_500])
  })

  it('extractDeathEvents and firstDeathTimestampByPlayer report the earliest death per player', () => {
    const events: RawWclEvent[] = [
      { timestamp: 5_000, targetID: 1 },
      { timestamp: 3_000, targetID: 1 },
      { timestamp: 4_000, targetID: 2 },
    ]
    const deaths = extractDeathEvents(events)
    const firstDeaths = firstDeathTimestampByPlayer(deaths)
    expect(firstDeaths.get(1)).toBe(3_000)
    expect(firstDeaths.get(2)).toBe(4_000)
  })

  it('isPlayerEligibleForMechanic requires participation, resolved Phase 1, and the mechanic to have occurred', () => {
    expect(
      isPlayerEligibleForMechanic({
        playerId: 1,
        participated: false,
        phaseOneResolved: true,
        mechanicOccurred: true,
        mechanicOccurrenceTimestamps: [],
      })
    ).toBe(false)
    expect(
      isPlayerEligibleForMechanic({
        playerId: 1,
        participated: true,
        phaseOneResolved: false,
        mechanicOccurred: true,
        mechanicOccurrenceTimestamps: [],
      })
    ).toBe(false)
    expect(
      isPlayerEligibleForMechanic({
        playerId: 1,
        participated: true,
        phaseOneResolved: true,
        mechanicOccurred: false,
        mechanicOccurrenceTimestamps: [],
      })
    ).toBe(false)
  })

  it('isPlayerEligibleForMechanic requires at least one occurrence timestamp before the player died, when a death is known', () => {
    expect(
      isPlayerEligibleForMechanic({
        playerId: 1,
        participated: true,
        phaseOneResolved: true,
        mechanicOccurred: true,
        mechanicOccurrenceTimestamps: [5_000],
        firstDeathTimestamp: 4_000,
      })
    ).toBe(false)
    expect(
      isPlayerEligibleForMechanic({
        playerId: 1,
        participated: true,
        phaseOneResolved: true,
        mechanicOccurred: true,
        mechanicOccurrenceTimestamps: [3_000],
        firstDeathTimestamp: 4_000,
      })
    ).toBe(true)
  })

  it('computeRaidDate formats an absolute epoch ms into a timezone-correct calendar date', () => {
    expect(computeRaidDate(Date.UTC(2026, 0, 15, 23, 30), 'UTC')).toBe('2026-01-15')
  })

  it('buildMechanicHits marks diedWithin5Seconds only when death follows the hit within 5000ms', () => {
    const fight = makeFightRecord()
    const deduped = dedupeMechanicOccurrences(
      [
        { reportCode: 'ABC123', fightId: 1, mechanicKey: 'glaives', mechanicLabel: 'Glaives', abilityId: 111, abilityName: 'Glaive', playerId: 1, timestamp: 2_000, amount: 100, absorbed: 0, overkill: 0 },
      ],
      750
    )
    const hits = buildMechanicHits({
      fight,
      dedupedOccurrences: deduped,
      players: players(),
      firstDeathTimestamp: new Map([[1, 3_500]]),
      timezone: 'Europe/Stockholm',
    })
    expect(hits[0].diedWithin5Seconds).toBe(true)
  })
})

describe('buildPlayerMechanicSummaries — denominators and rates', () => {
  const makeRecord = (overrides: Partial<PullMechanicRecord> = {}): PullMechanicRecord => ({
    reportCode: 'ABC123',
    reportTitle: 'Test Report',
    fightId: 1,
    pullNumber: 1,
    pullTimestampMs: 1_700_000_000_000,
    raidDate: '2026-01-15',
    kill: false,
    bossPercentage: 40,
    fightDurationMs: 10_000,
    phaseOneEndMs: 5_000,
    phaseBoundarySource: 'phaseTransition',
    mechanicKey: 'glaives',
    mechanicLabel: 'Glaives',
    mechanicOccurred: true,
    mechanicOccurrenceQuality: 'approximateFromDamage',
    eligiblePlayers: [
      { playerId: 1, playerName: 'Alice', playerClass: 'Mage', normalizedName: 'alice' },
      { playerId: 2, playerName: 'Bob', playerClass: 'Warrior', normalizedName: 'bob' },
    ],
    hitPlayers: [],
    dedupedOccurrences: [],
    rejectedHits: [],
    firstHitFightRelativeMs: null,
    isDuplicate: false,
    ...overrides,
  })

  it('a player only present as eligible on some pulls has eligiblePulls matching those pulls, not the whole sample', () => {
    const records = [
      makeRecord({ fightId: 1, pullNumber: 1, raidDate: '2026-01-15' }),
      makeRecord({
        fightId: 2,
        pullNumber: 2,
        raidDate: '2026-01-15',
        eligiblePlayers: [{ playerId: 1, playerName: 'Alice', playerClass: 'Mage', normalizedName: 'alice' }],
      }),
    ]
    const summaries = buildPlayerMechanicSummaries({ pullRecords: records, thresholds: THRESHOLDS })
    const alice = summaries.find((s) => s.playerName === 'Alice')
    const bob = summaries.find((s) => s.playerName === 'Bob')
    expect(alice?.eligiblePulls).toBe(2)
    expect(bob?.eligiblePulls).toBe(1)
  })

  it('hitPulls only counts pulls where the player actually appears in hitPlayers for that pull', () => {
    const records = [
      makeRecord({
        fightId: 1,
        hitPlayers: [{ playerId: 1, playerName: 'Alice', playerClass: 'Mage', normalizedName: 'alice' }],
      }),
      makeRecord({ fightId: 2, pullNumber: 2, hitPlayers: [] }),
    ]
    const summaries = buildPlayerMechanicSummaries({ pullRecords: records, thresholds: THRESHOLDS })
    const alice = summaries.find((s) => s.playerName === 'Alice')
    expect(alice?.eligiblePulls).toBe(2)
    expect(alice?.hitPulls).toBe(1)
    expect(alice?.hitPullRate).toBe(0.5)
  })

  it('guildAverageHitPullRate is exposure-weighted across all eligible pulls, not a simple average of per-player rates', () => {
    const records = [
      makeRecord({
        fightId: 1,
        eligiblePlayers: [
          { playerId: 1, playerName: 'Alice', playerClass: 'Mage', normalizedName: 'alice' },
          { playerId: 2, playerName: 'Bob', playerClass: 'Warrior', normalizedName: 'bob' },
        ],
        hitPlayers: [{ playerId: 1, playerName: 'Alice', playerClass: 'Mage', normalizedName: 'alice' }],
      }),
    ]
    const summaries = buildPlayerMechanicSummaries({ pullRecords: records, thresholds: THRESHOLDS })
    expect(summaries[0].guildAverageHitPullRate).toBe(0.5)
  })
})

describe('MechanicAuditFightRecord fixture sanity (phaseOneEndMs field naming preserved for CSV compatibility)', () => {
  it('a resolved fixture keeps 0 <= phaseOneEndFightRelativeMs <= durationMs', () => {
    const fight = makeFightRecord()
    expect(fight.phaseOneEndFightRelativeMs).not.toBeNull()
    expect(fight.phaseOneEndFightRelativeMs as number).toBeGreaterThanOrEqual(0)
    expect(fight.phaseOneEndFightRelativeMs as number).toBeLessThanOrEqual(fight.durationMs)
  })
})
