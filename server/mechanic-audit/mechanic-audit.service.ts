import crypto from 'node:crypto'
import type { WclConfigWithSite } from '../warcraft-logs/wcl-request-context'
import { requireGuildIdForGuildScopedFlow } from '../warcraft-logs/wcl-request-context'
import { classifyWclError, isLikelyWclError } from '../warcraft-logs/wcl-error-hints'
import {
  discoverReportsByDateRange,
  fetchReportFightsAndPlayers,
  normalizeManualReportCodes,
  type ReportFightsResult,
} from './mechanic-audit-report-discovery'
import { fetchReportEventsForFights, resolveEventAbilityId } from './mechanic-audit-event-fetcher'
import { assertValidMechanicAuditRequest } from './mechanic-audit-validation'
import {
  assignPullNumbers,
  buildMechanicHits,
  buildMechanicSummary,
  buildPlayerMechanicSummaries,
  buildPullMechanicRecord,
  computeRaidDate,
  dedupeMechanicOccurrences,
  deriveFightRelativePhaseOneEnd,
  detectDuplicateFights,
  extractDeathEvents,
  extractMechanicOccurrences,
  extractOccurrenceEvidenceTimestamps,
  filterEventsWithinPhaseOne,
  firstDeathTimestampByPlayer,
  mapEventsToFights,
  normalizePlayerName,
  resolveMechanicOccurrence,
  resolvePhaseOneBoundary,
  type DuplicateFightCandidate,
  type DuplicateFightInfo,
  type FightForAggregation,
  type PullMechanicRecord,
} from './mechanic-audit-aggregation'
import { buildEventsCsv, buildPlayerSummaryCsv, buildPullSummaryCsv } from './mechanic-audit-csv'
import { createBundleZip, ensureExportDir, writeExportFile, writeExportJsonFile } from './mechanic-audit-export-files'
import { MechanicAuditJobStore } from './mechanic-audit-job-store'
import {
  MECHANIC_AUDIT_DEFAULT_DEDUPE_WINDOW_MS,
  MECHANIC_AUDIT_DEFAULT_THRESHOLDS,
  MECHANIC_AUDIT_DEFAULT_TIMEZONE,
  type MechanicAuditExcludedFightCategorySummary,
  type MechanicAuditExportFile,
  type MechanicAuditExportResultSummary,
  type MechanicAuditExportStartResponse,
  type MechanicAuditMechanic,
  type MechanicAuditOccurrenceEventType,
  type MechanicAuditPreviewResponse,
  type MechanicAuditRequest,
  type MechanicAuditThresholds,
  type MechanicAuditWarningCategory,
  type MechanicHit,
} from './mechanic-audit.types'

const resolveConfigSite = (config: WclConfigWithSite): string | undefined => config.WCL_SITE

// ---------------------------------------------------------------------------
// Scope resolution — guild-wide date range vs. explicit report codes
// ---------------------------------------------------------------------------

const resolveScopeReportCodes = async (
  config: WclConfigWithSite,
  request: MechanicAuditRequest,
  warnings: string[]
): Promise<{ reportCodes: string[]; reportsScanned: number }> => {
  if (request.scope.mode === 'manualReports') {
    const codes = normalizeManualReportCodes(request.scope.reportCodes)
    return { reportCodes: codes, reportsScanned: codes.length }
  }

  const guildId = requireGuildIdForGuildScopedFlow(config.WCL_GUILD_ID)
  const discovery = await discoverReportsByDateRange({
    config,
    site: config.WCL_SITE,
    guildId: Number(guildId),
    since: request.scope.since,
    until: request.scope.until,
  })
  warnings.push(...discovery.warnings.map((w) => w.message))
  return { reportCodes: discovery.reports.map((r) => r.code), reportsScanned: discovery.reports.length }
}

const buildAbilityIdToMechanic = (mechanics: MechanicAuditMechanic[]): Map<number, MechanicAuditMechanic> =>
  new Map(mechanics.flatMap((mechanic) => mechanic.abilityIds.map((id) => [id, mechanic] as const)))

// ---------------------------------------------------------------------------
// Preview — cheap discovery + a small event sample, no full export
// ---------------------------------------------------------------------------

const MAX_PREVIEW_SAMPLE_FIGHTS = 3

export const previewMechanicAudit = async (
  config: WclConfigWithSite,
  request: MechanicAuditRequest
): Promise<MechanicAuditPreviewResponse> => {
  assertValidMechanicAuditRequest(request)
  const timezone = request.timezone ?? MECHANIC_AUDIT_DEFAULT_TIMEZONE
  const warnings: string[] = []

  const { reportCodes, reportsScanned } = await resolveScopeReportCodes(config, request, warnings)
  const mechanicAbilityIds = [...new Set(request.mechanics.flatMap((m) => m.abilityIds))]
  const abilityIdToMechanic = buildAbilityIdToMechanic(request.mechanics)

  let reportsMatched = 0
  let fightsMatched = 0
  let sampledFights = 0
  const raidDates: string[] = []
  const observedAbilityIds = new Set<number>()

  for (const reportCode of reportCodes) {
    try {
      const reportResult = await fetchReportFightsAndPlayers({
        config,
        site: config.WCL_SITE,
        reportCode,
        encounterId: request.encounter.encounterId,
        encounterName: request.encounter.encounterName,
        difficulty: request.encounter.difficulty,
      })
      if (!reportResult || reportResult.fights.length === 0) continue

      reportsMatched += 1
      fightsMatched += reportResult.fights.length
      for (const fight of reportResult.fights) {
        raidDates.push(computeRaidDate(fight.reportStartTime + fight.fightStartTime, timezone))
      }

      if (sampledFights < MAX_PREVIEW_SAMPLE_FIGHTS && mechanicAbilityIds.length > 0) {
        const sampleFights = reportResult.fights.slice(0, MAX_PREVIEW_SAMPLE_FIGHTS - sampledFights)
        const sampleResult = await fetchReportEventsForFights({
          config,
          site: config.WCL_SITE,
          reportCode,
          fightIds: sampleFights.map((f) => f.fightId),
          abilityIds: mechanicAbilityIds,
          dataType: 'DamageTaken',
          reportStartTime: 0,
          reportEndTime: Math.max(...sampleFights.map((f) => f.fightEndTime)),
        })
        for (const event of sampleResult.events) {
          const abilityId = resolveEventAbilityId(event)
          if (abilityId !== undefined && abilityIdToMechanic.has(abilityId)) observedAbilityIds.add(abilityId)
        }
        warnings.push(...sampleResult.warnings)
        sampledFights += sampleFights.length
      }
    } catch (error) {
      warnings.push(`Failed to inspect report ${reportCode}: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }

  raidDates.sort()

  return {
    reportsScanned,
    reportsMatched,
    fightsScanned: fightsMatched,
    fightsMatched,
    estimatedPullCount: fightsMatched,
    raidDateRange: { earliest: raidDates[0] ?? null, latest: raidDates[raidDates.length - 1] ?? null },
    encounter: request.encounter,
    difficulty: request.encounter.difficulty,
    mechanics: request.mechanics.map((m) => ({
      key: m.key,
      label: m.label,
      abilityIds: m.abilityIds,
      observedInSample: m.abilityIds.some((id) => observedAbilityIds.has(id)),
    })),
    phaseBoundaryMode: request.phaseOneBoundary.mode,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Export: start (sync, returns immediately)
// ---------------------------------------------------------------------------

export const startMechanicAuditExport = (config: WclConfigWithSite, request: MechanicAuditRequest): MechanicAuditExportStartResponse => {
  assertValidMechanicAuditRequest(request)
  const auditId = crypto.randomUUID()

  // Rough step estimate: discover reports, discover fights, process reports, aggregate, write/zip.
  const totalSteps = 5

  MechanicAuditJobStore.create(auditId, totalSteps)

  setImmediate(() => {
    runMechanicAuditExport(config, request, auditId).catch((error: unknown) => {
      const classified = isLikelyWclError(error) ? classifyWclError(error, { site: resolveConfigSite(config) }) : null
      const message = classified?.message ?? (error instanceof Error ? error.message : 'Unexpected export error')
      const errorWithHint = classified?.hint ? `${message} ${classified.hint}` : message
      console.error('[mechanic-audit] export job failed:', error)
      MechanicAuditJobStore.fail(auditId, message, { warnings: [errorWithHint], currentStep: 'Export failed.' })
    })
  })

  return { auditId, status: 'queued', statusUrl: `/api/mechanic-audits/${auditId}/status` }
}

// ---------------------------------------------------------------------------
// Export: async runner (background, never touches HTTP response)
// ---------------------------------------------------------------------------

type ExcludedFightEntry = MechanicAuditExportResultSummary['fightsExcluded'][number]

type ReportProcessingResult = {
  pullRecords: PullMechanicRecord[]
  hits: MechanicHit[]
  warnings: string[]
  fightsScanned: number
  fightsIncluded: number
  excludedFights: ExcludedFightEntry[]
  rawEventCount: number
  deduplicatedEventCount: number
  truncated: boolean
}

/**
 * Resolves the marker ability IDs needed for this request, whether the boundary mode is
 * `markerAbility` directly or `phaseTransition` with a `markerAbilityThenFightEndForWipes`
 * no-transition fallback configured.
 */
const resolveMarkerAbilityIds = (request: MechanicAuditRequest): number[] => {
  if (request.phaseOneBoundary.mode === 'markerAbility') return request.phaseOneBoundary.abilityIds
  if (
    request.phaseOneBoundary.mode === 'phaseTransition' &&
    request.phaseOneBoundary.noTransitionFallback?.mode === 'markerAbilityThenFightEndForWipes'
  ) {
    return request.phaseOneBoundary.noTransitionFallback.abilityIds
  }
  return []
}

const processReportForExport = async (params: {
  config: WclConfigWithSite
  reportResult: ReportFightsResult
  request: MechanicAuditRequest
  timezone: string
  abilityIdToMechanic: Map<number, MechanicAuditMechanic>
  duplicateInfo: Map<string, DuplicateFightInfo>
}): Promise<ReportProcessingResult> => {
  const { config, reportResult, request, timezone, abilityIdToMechanic, duplicateInfo } = params
  const reportCode = reportResult.reportCode
  const warnings: string[] = []
  const excludedFights: ExcludedFightEntry[] = []

  const numberedFights = assignPullNumbers(reportResult.fights)
  const maxFightEndTime = Math.max(...numberedFights.map((f) => f.fightEndTime))
  const fightWindowsAll = numberedFights.map((f) => ({ fightId: f.fightId, fightStartTime: f.fightStartTime, fightEndTime: f.fightEndTime }))

  const markerAbilityIds = resolveMarkerAbilityIds(request)
  let markerTimestampsByFight = new Map<number, number[]>()
  if (markerAbilityIds.length > 0) {
    const markerResult = await fetchReportEventsForFights({
      config,
      site: config.WCL_SITE,
      reportCode,
      fightIds: numberedFights.map((f) => f.fightId),
      abilityIds: markerAbilityIds,
      dataType: 'Casts',
      reportStartTime: 0,
      reportEndTime: maxFightEndTime,
    })
    warnings.push(...markerResult.warnings)
    const byFight = mapEventsToFights(markerResult.events, fightWindowsAll)
    markerTimestampsByFight = new Map(
      [...byFight.entries()].map(([fightId, events]) => [
        fightId,
        events.map((e) => e.timestamp).filter((t): t is number => typeof t === 'number'),
      ])
    )
  }

  const fights: FightForAggregation[] = []

  for (const fight of numberedFights) {
    const dupKey = `${reportCode}::${fight.fightId}`
    const dupInfo = duplicateInfo.get(dupKey)

    if (dupInfo && !dupInfo.isCanonical) {
      fights.push({
        ...fight,
        phaseOneEndReportRelativeMs: null,
        phaseOneEndFightRelativeMs: null,
        phaseBoundarySource: 'unresolved',
        isDuplicate: true,
        duplicateGroupId: dupInfo.groupId,
        canonicalReportCode: dupInfo.canonicalReportCode,
        duplicateReportCodes: dupInfo.duplicateReportCodes,
        deduplicationConfidence: dupInfo.confidence,
      })
      excludedFights.push({
        reportCode,
        fightId: fight.fightId,
        reason: `Fight ${fight.fightId}: detected as a duplicate of ${dupInfo.canonicalReportCode} fight ${dupInfo.canonicalFightId} (confidence: ${dupInfo.confidence}); excluded from aggregation, canonical copy retained.`,
        category: 'duplicatePull',
      })
      continue
    }

    const baseFight = {
      ...fight,
      isDuplicate: false,
      duplicateGroupId: dupInfo?.groupId,
      canonicalReportCode: dupInfo?.isCanonical ? reportCode : undefined,
      duplicateReportCodes: dupInfo?.duplicateReportCodes,
      deduplicationConfidence: dupInfo?.confidence,
    }

    const resolution = resolvePhaseOneBoundary(
      {
        fightId: fight.fightId,
        fightStartTime: fight.fightStartTime,
        fightEndTime: fight.fightEndTime,
        durationMs: fight.durationMs,
        kill: fight.kill,
      },
      request.phaseOneBoundary,
      {
        phaseTransitions: reportResult.phaseTransitionsByFightId.get(fight.fightId),
        markerEventTimestamps: markerTimestampsByFight.get(fight.fightId),
      }
    )

    if (!resolution.resolved) {
      fights.push({ ...baseFight, phaseOneEndReportRelativeMs: null, phaseOneEndFightRelativeMs: null, phaseBoundarySource: 'unresolved' })
      excludedFights.push({ reportCode, fightId: fight.fightId, reason: resolution.warning, category: 'missingPhaseTransition' })
      continue
    }

    const derivation = deriveFightRelativePhaseOneEnd(fight, resolution.phaseOneEndMs)
    if (!derivation.ok) {
      fights.push({ ...baseFight, phaseOneEndReportRelativeMs: null, phaseOneEndFightRelativeMs: null, phaseBoundarySource: 'unresolved' })
      excludedFights.push({ reportCode, fightId: fight.fightId, reason: derivation.error, category: 'timestampInvariant' })
      continue
    }

    fights.push({
      ...baseFight,
      phaseOneEndReportRelativeMs: derivation.reportRelativeMs,
      phaseOneEndFightRelativeMs: derivation.fightRelativeMs,
      phaseBoundarySource: resolution.source,
      phaseBoundaryWarning: resolution.diagnostic,
    })
  }

  const resolvedFights = fights.filter((f) => f.phaseOneEndFightRelativeMs !== null && !f.isDuplicate)
  const damageAbilityIds = [...new Set(request.mechanics.flatMap((m) => m.abilityIds))]

  const occurrenceEventTypes = [
    ...new Set(
      request.mechanics
        .filter((m) => (m.occurrenceAbilityIds?.length ?? 0) > 0 && m.occurrenceEventType)
        .map((m) => m.occurrenceEventType as MechanicAuditOccurrenceEventType)
    ),
  ]

  let rawEventCount = 0
  let deduplicatedEventCount = 0
  let truncated = false
  const pullRecords: PullMechanicRecord[] = []
  const hits: MechanicHit[] = []

  if (resolvedFights.length > 0) {
    const fightIds = resolvedFights.map((f) => f.fightId)
    const fightWindows = resolvedFights.map((f) => ({ fightId: f.fightId, fightStartTime: f.fightStartTime, fightEndTime: f.fightEndTime }))

    const [damageResult, deathsResult, ...occurrenceResults] = await Promise.all([
      fetchReportEventsForFights({
        config,
        site: config.WCL_SITE,
        reportCode,
        fightIds,
        abilityIds: damageAbilityIds,
        dataType: 'DamageTaken',
        reportStartTime: 0,
        reportEndTime: maxFightEndTime,
      }),
      fetchReportEventsForFights({
        config,
        site: config.WCL_SITE,
        reportCode,
        fightIds,
        abilityIds: [],
        dataType: 'Deaths',
        reportStartTime: 0,
        reportEndTime: maxFightEndTime,
      }),
      ...occurrenceEventTypes.map(async (eventType) => {
        const abilityIds = [
          ...new Set(
            request.mechanics.filter((m) => m.occurrenceEventType === eventType).flatMap((m) => m.occurrenceAbilityIds ?? [])
          ),
        ]
        const result = await fetchReportEventsForFights({
          config,
          site: config.WCL_SITE,
          reportCode,
          fightIds,
          abilityIds,
          dataType: eventType,
          reportStartTime: 0,
          reportEndTime: maxFightEndTime,
        })
        return { eventType, result }
      }),
    ])
    warnings.push(...damageResult.warnings, ...deathsResult.warnings)
    truncated = damageResult.truncated || deathsResult.truncated
    rawEventCount += damageResult.events.length

    const occurrenceAbilityIdToMechanicKeyByEventType = new Map<MechanicAuditOccurrenceEventType, Map<number, string>>()
    for (const mechanic of request.mechanics) {
      if (!mechanic.occurrenceAbilityIds?.length || !mechanic.occurrenceEventType) continue
      let byAbility = occurrenceAbilityIdToMechanicKeyByEventType.get(mechanic.occurrenceEventType)
      if (!byAbility) {
        byAbility = new Map()
        occurrenceAbilityIdToMechanicKeyByEventType.set(mechanic.occurrenceEventType, byAbility)
      }
      for (const id of mechanic.occurrenceAbilityIds) byAbility.set(id, mechanic.key)
    }

    // fightId -> mechanicKey -> occurrence-evidence timestamps (report-relative), independent of hits.
    const occurrenceEvidenceByFight = new Map<number, Map<string, number[]>>()
    for (const { eventType, result } of occurrenceResults) {
      warnings.push(...result.warnings)
      truncated = truncated || result.truncated
      rawEventCount += result.events.length
      const abilityIdToKey = occurrenceAbilityIdToMechanicKeyByEventType.get(eventType) ?? new Map<number, string>()
      const byFight = mapEventsToFights(result.events, fightWindows)
      for (const fight of resolvedFights) {
        const evidence = extractOccurrenceEvidenceTimestamps({
          fightId: fight.fightId,
          events: byFight.get(fight.fightId) ?? [],
          occurrenceAbilityIdToMechanicKey: abilityIdToKey,
        })
        let existing = occurrenceEvidenceByFight.get(fight.fightId)
        if (!existing) {
          existing = new Map()
          occurrenceEvidenceByFight.set(fight.fightId, existing)
        }
        for (const [key, timestamps] of evidence) {
          const list = existing.get(key)
          if (list) list.push(...timestamps)
          else existing.set(key, timestamps)
        }
      }
    }

    const damageByFight = mapEventsToFights(damageResult.events, fightWindows)
    const deathsByFight = mapEventsToFights(deathsResult.events, fightWindows)

    for (const fight of resolvedFights) {
      const phaseOneEndReportRelativeMs = fight.phaseOneEndReportRelativeMs as number
      const fightDamageEvents = filterEventsWithinPhaseOne(damageByFight.get(fight.fightId) ?? [], phaseOneEndReportRelativeMs)
      const rawOccurrences = extractMechanicOccurrences({
        reportCode,
        fightId: fight.fightId,
        events: fightDamageEvents,
        abilityIdToMechanic,
      })
      const deathEvents = extractDeathEvents(deathsByFight.get(fight.fightId) ?? [])
      const firstDeathTimestamp = firstDeathTimestampByPlayer(deathEvents)
      const evidenceForFight = occurrenceEvidenceByFight.get(fight.fightId) ?? new Map<string, number[]>()

      for (const mechanic of request.mechanics) {
        const mechanicOccurrences = rawOccurrences.filter((o) => o.mechanicKey === mechanic.key)
        const dedupeWindowMs = mechanic.dedupeWindowMs ?? MECHANIC_AUDIT_DEFAULT_DEDUPE_WINDOW_MS
        const dedupedOccurrences = dedupeMechanicOccurrences(mechanicOccurrences, dedupeWindowMs)
        deduplicatedEventCount += dedupedOccurrences.length

        const hasOccurrenceConfig = (mechanic.occurrenceAbilityIds?.length ?? 0) > 0 && Boolean(mechanic.occurrenceEventType)
        const occurrenceTimestampsInPhase1 = (evidenceForFight.get(mechanic.key) ?? []).filter(
          (t) => t < phaseOneEndReportRelativeMs
        )

        const { mechanicOccurred, mechanicOccurrenceQuality } = resolveMechanicOccurrence({
          hasOccurrenceConfig,
          occurrenceTimestampsInPhase1,
          dedupedOccurrenceCount: dedupedOccurrences.length,
        })

        const record = buildPullMechanicRecord({
          fight,
          mechanic,
          dedupedOccurrences,
          mechanicOccurred,
          mechanicOccurrenceQuality,
          players: reportResult.players,
          firstDeathTimestamp,
          timezone,
        })
        pullRecords.push(record)
        hits.push(
          ...buildMechanicHits({
            fight,
            dedupedOccurrences: record.dedupedOccurrences,
            players: reportResult.players,
            firstDeathTimestamp,
            timezone,
          })
        )
      }
    }
  }

  return {
    pullRecords,
    hits,
    warnings,
    fightsScanned: fights.length,
    fightsIncluded: resolvedFights.length,
    excludedFights,
    rawEventCount,
    deduplicatedEventCount,
    truncated,
  }
}

const describeWarningCategory = (category: MechanicAuditWarningCategory): string => {
  switch (category) {
    case 'missingPhaseTransition':
      return 'missing/unresolvable Phase 1 boundary'
    case 'missingParticipation':
      return 'missing player participation data'
    case 'eventFetchFailure':
      return 'event fetch failure'
    case 'duplicatePull':
      return 'cross-report duplicate'
    case 'timestampInvariant':
      return 'invalid computed timestamp'
    case 'truncation':
      return 'truncated event fetch'
    case 'other':
      return 'other reason'
  }
}

const runMechanicAuditExport = async (config: WclConfigWithSite, request: MechanicAuditRequest, auditId: string): Promise<void> => {
  const timezone = request.timezone ?? MECHANIC_AUDIT_DEFAULT_TIMEZONE
  const thresholds: MechanicAuditThresholds = { ...MECHANIC_AUDIT_DEFAULT_THRESHOLDS, ...request.thresholds }
  const abilityIdToMechanic = buildAbilityIdToMechanic(request.mechanics)

  const allWarnings: string[] = []

  MechanicAuditJobStore.setStep(auditId, 'Discovering reports…')
  const { reportCodes, reportsScanned } = await resolveScopeReportCodes(config, request, allWarnings)
  MechanicAuditJobStore.advance(auditId)

  MechanicAuditJobStore.setStep(auditId, `Discovering fights across ${reportCodes.length} report(s)…`)
  const reportResults: ReportFightsResult[] = []
  for (const reportCode of reportCodes) {
    try {
      const reportResult = await fetchReportFightsAndPlayers({
        config,
        site: config.WCL_SITE,
        reportCode,
        encounterId: request.encounter.encounterId,
        encounterName: request.encounter.encounterName,
        difficulty: request.encounter.difficulty,
      })
      if (reportResult && reportResult.fights.length > 0) reportResults.push(reportResult)
    } catch (error) {
      allWarnings.push(`Failed to discover fights for report ${reportCode}: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }
  MechanicAuditJobStore.advance(auditId)

  // Cross-report duplicate detection runs on discovered fights, before any event fetching —
  // duplicates never get their events fetched or aggregated, only their canonical copy does.
  const duplicateCandidates: DuplicateFightCandidate[] = reportResults.flatMap((report) =>
    report.fights.map((fight) => ({
      reportCode: report.reportCode,
      fightId: fight.fightId,
      absoluteStartTime: report.reportStartTime + fight.fightStartTime,
      durationMs: fight.durationMs,
      bossPercentage: fight.bossPercentage ?? null,
      kill: fight.kill,
      playerNames: new Set(
        fight.friendlyPlayerIds
          .map((id) => report.players.get(id)?.playerName)
          .filter((name): name is string => typeof name === 'string' && name.length > 0)
          .map(normalizePlayerName)
      ),
    }))
  )
  const duplicateInfo = detectDuplicateFights(duplicateCandidates)
  const duplicateGroupCount = new Set([...duplicateInfo.values()].map((d) => d.groupId)).size
  const duplicateFightsExcludedTotal = [...duplicateInfo.values()].filter((d) => !d.isCanonical).length

  const allPullRecords: PullMechanicRecord[] = []
  const allHits: MechanicHit[] = []
  const allExcludedFights: ExcludedFightEntry[] = []
  let reportsIncluded = 0
  let fightsScanned = 0
  let fightsIncluded = 0
  let rawEventCount = 0
  let deduplicatedEventCount = 0
  let truncated = false

  MechanicAuditJobStore.setStep(auditId, `Processing ${reportResults.length} report(s)…`)
  for (const reportResult of reportResults) {
    try {
      const result = await processReportForExport({ config, reportResult, request, timezone, abilityIdToMechanic, duplicateInfo })
      reportsIncluded += 1
      fightsScanned += result.fightsScanned
      fightsIncluded += result.fightsIncluded
      rawEventCount += result.rawEventCount
      deduplicatedEventCount += result.deduplicatedEventCount
      truncated = truncated || result.truncated
      allWarnings.push(...result.warnings)
      allExcludedFights.push(...result.excludedFights)
      allPullRecords.push(...result.pullRecords)
      allHits.push(...result.hits)
    } catch (error) {
      allWarnings.push(`Failed to process report ${reportResult.reportCode}: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }
  MechanicAuditJobStore.advance(auditId)

  const excludedFightCategorySummary: MechanicAuditExcludedFightCategorySummary[] = Object.entries(
    allExcludedFights.reduce<Partial<Record<MechanicAuditWarningCategory, number>>>((acc, f) => {
      acc[f.category] = (acc[f.category] ?? 0) + 1
      return acc
    }, {})
  ).map(([category, count]) => ({ category: category as MechanicAuditWarningCategory, count: count as number }))

  if (excludedFightCategorySummary.length > 0) {
    const parts = excludedFightCategorySummary.map((c) => `${c.count} ${describeWarningCategory(c.category)}`)
    allWarnings.push(`${allExcludedFights.length} pull(s) excluded from analysis: ${parts.join(', ')}. Full per-pull detail is in manifest.json.`)
  }

  MechanicAuditJobStore.setStep(auditId, 'Aggregating results…')
  const playerSummaries = buildPlayerMechanicSummaries({ pullRecords: allPullRecords, thresholds })
  const canonicalFightsScanned = fightsScanned - duplicateFightsExcludedTotal
  const mechanicSummaries = request.mechanics.map((mechanic) => {
    const mechanicPullRecords = allPullRecords.filter((r) => r.mechanicKey === mechanic.key)
    return buildMechanicSummary({
      mechanicKey: mechanic.key,
      mechanicLabel: mechanic.label,
      playerSummaries: playerSummaries.filter((s) => s.mechanicKey === mechanic.key),
      thresholds,
      matchedFights: canonicalFightsScanned,
      includedFights: mechanicPullRecords.length,
      pullsWithEligiblePlayer: mechanicPullRecords.filter((r) => r.eligiblePlayers.length > 0).length,
    })
  })
  MechanicAuditJobStore.advance(auditId)

  MechanicAuditJobStore.setStep(auditId, 'Writing export files…')
  ensureExportDir(auditId)

  const eventsCsv = buildEventsCsv(allHits)
  const playerSummaryCsv = buildPlayerSummaryCsv(playerSummaries)
  const pullSummaryCsv = buildPullSummaryCsv(allPullRecords)

  const eventsFile = writeExportFile(auditId, 'lura-p1-events.csv', eventsCsv)
  const playerSummaryFile = writeExportFile(auditId, 'lura-p1-player-summary.csv', playerSummaryCsv)
  const pullSummaryFile = writeExportFile(auditId, 'lura-p1-pull-summary.csv', pullSummaryCsv)

  const resultSummary: MechanicAuditExportResultSummary = {
    reportsScanned,
    reportsIncluded,
    fightsScanned,
    fightsIncluded,
    fightsExcluded: allExcludedFights,
    excludedFightCategorySummary,
    duplicateFightsExcluded: duplicateFightsExcludedTotal,
    duplicateGroupCount,
    rawEventCount,
    deduplicatedEventCount,
    truncated,
  }

  const manifest = {
    auditId,
    generatedAt: new Date().toISOString(),
    request: { ...request, wclContext: undefined },
    timezone,
    thresholds,
    resultSummary,
    warnings: allWarnings,
  }
  const manifestFile = writeExportJsonFile(auditId, 'manifest.json', manifest)

  const readme = buildReadme({ request, timezone, thresholds, resultSummary, mechanicSummaries, warnings: allWarnings })
  const readmeFile = writeExportFile(auditId, 'README.md', readme)

  const auditJson = writeExportJsonFile(auditId, 'audit.json', {
    auditId,
    generatedAt: new Date().toISOString(),
    encounter: request.encounter,
    thresholds,
    resultSummary,
    mechanicSummaries,
    playerSummaries,
    hits: allHits,
  })

  const zipFilenames = [
    'lura-p1-events.csv',
    'lura-p1-player-summary.csv',
    'lura-p1-pull-summary.csv',
    'manifest.json',
    'README.md',
    'audit.json',
  ]
  const zip = await createBundleZip(auditId, zipFilenames)
  MechanicAuditJobStore.advance(auditId)

  const files: MechanicAuditExportFile[] = [
    { filename: 'lura-p1-events.csv', sizeBytes: eventsFile.sizeBytes, rowCount: allHits.length },
    { filename: 'lura-p1-player-summary.csv', sizeBytes: playerSummaryFile.sizeBytes, rowCount: playerSummaries.length },
    { filename: 'lura-p1-pull-summary.csv', sizeBytes: pullSummaryFile.sizeBytes, rowCount: allPullRecords.length },
    { filename: 'manifest.json', sizeBytes: manifestFile.sizeBytes },
    { filename: 'README.md', sizeBytes: readmeFile.sizeBytes },
    { filename: 'audit.json', sizeBytes: auditJson.sizeBytes },
    { filename: 'bundle.zip', sizeBytes: zip.sizeBytes },
  ]

  if (reportsIncluded === 0) {
    MechanicAuditJobStore.fail(auditId, 'No reports matched the requested scope and encounter/difficulty.', {
      warnings: allWarnings,
      currentStep: 'Export failed: no matching data.',
    })
    return
  }

  if (truncated || allExcludedFights.length > 0 || allWarnings.length > 0) {
    MechanicAuditJobStore.partial(auditId, files, { warnings: allWarnings, resultSummary, currentStep: 'Export complete with partial data.' })
  } else {
    MechanicAuditJobStore.complete(auditId, files, { warnings: allWarnings, resultSummary, currentStep: 'Export complete.' })
  }
}

const buildReadme = (params: {
  request: MechanicAuditRequest
  timezone: string
  thresholds: MechanicAuditThresholds
  resultSummary: MechanicAuditExportResultSummary
  mechanicSummaries: ReturnType<typeof buildMechanicSummary>[]
  warnings: string[]
}): string => {
  const { request, timezone, thresholds, resultSummary, mechanicSummaries, warnings } = params
  const lines: string[] = []
  lines.push(`# Mechanic Audit Export — ${request.encounter.encounterName ?? `Encounter ${request.encounter.encounterId}`}`)
  lines.push('')
  lines.push(
    'This export is evidence for officer review, not an automatic judgement. It shows which players were hit by ' +
      'the audited mechanics during Phase 1, relative to how often each player was actually eligible (present, alive, ' +
      'and the mechanic occurred). It does not shame or rank players automatically — read the "How to interpret this" ' +
      'section below before drawing conclusions.'
  )
  lines.push('')
  lines.push('## Scope')
  lines.push(`- Encounter: ${request.encounter.encounterName ?? request.encounter.encounterId} (difficulty ${request.encounter.difficulty})`)
  lines.push(`- Mechanics audited: ${request.mechanics.map((m) => m.label).join(', ')}`)
  lines.push(`- Phase 1 boundary strategy: ${request.phaseOneBoundary.mode}`)
  if (request.phaseOneBoundary.mode === 'phaseTransition') {
    const fallback = request.phaseOneBoundary.noTransitionFallback?.mode ?? 'exclude'
    lines.push(`- No-transition fallback: ${fallback} (explicit configuration; pulls resolved via a fallback are marked in pull-summary.csv's phaseBoundarySource column)`)
  }
  lines.push(`- Timezone used for raid-night grouping: ${timezone}`)
  lines.push(`- Reports scanned: ${resultSummary.reportsScanned}, included: ${resultSummary.reportsIncluded}`)
  lines.push(`- Pulls scanned: ${resultSummary.fightsScanned}, included in analysis: ${resultSummary.fightsIncluded}`)
  if (resultSummary.duplicateFightsExcluded > 0) {
    lines.push(
      `- Cross-report duplicates detected: ${resultSummary.duplicateFightsExcluded} pull(s) across ${resultSummary.duplicateGroupCount} group(s), excluded from aggregation (canonical copy retained per group).`
    )
  }
  lines.push(`- Raw events matched: ${resultSummary.rawEventCount}, deduplicated hits: ${resultSummary.deduplicatedEventCount}`)
  if (resultSummary.truncated) lines.push('- **Warning:** one or more report event fetches were truncated by configured limits.')
  lines.push('')
  lines.push('## Excluded pulls')
  if (resultSummary.excludedFightCategorySummary.length === 0) {
    lines.push('No pulls were excluded from analysis in this run.')
  } else {
    for (const category of resultSummary.excludedFightCategorySummary) {
      lines.push(`- ${category.count} pull(s): ${describeWarningCategory(category.category)}`)
    }
    lines.push('')
    lines.push('Full per-pull detail (report/fight/reason) is in `manifest.json`.')
  }
  lines.push('')
  lines.push('## Denominators & deduplication')
  lines.push(
    '`eligiblePulls` counts pulls where a player was present, Phase 1 was resolvable, the mechanic actually occurred, ' +
      'and the player was alive for at least one occurrence (approximated from the first recorded death per pull — ' +
      'this does not account for combat resurrection). `hitPulls` counts pulls where the player was hit at least once. ' +
      `Repeated hits on the same player within ${MECHANIC_AUDIT_DEFAULT_DEDUPE_WINDOW_MS}ms (or a mechanic's configured ` +
      'window) are collapsed into a single hit to avoid inflating counts from multi-tick abilities. Each pull-summary row ' +
      'also reports `mechanicOccurrenceQuality`: "verified" means an independent occurrence signal (boss cast/debuff) ' +
      'confirmed the mechanic happened; "approximateFromDamage" means occurrence was inferred only from players being hit, ' +
      'so a pull where nobody was hit and no independent signal was configured cannot be conservatively distinguished from ' +
      '"mechanic did not occur."'
  )
  lines.push('')
  lines.push('## Review-candidate thresholds')
  lines.push(
    `A player is flagged as a review candidate only when ALL of: eligiblePulls >= ${thresholds.minimumEligiblePulls}, ` +
      `raidNightsWithFailure >= ${thresholds.minimumRaidNightsWithFailure}, hitPullRate >= guildAverage × ${thresholds.guildAverageMultiplier}, ` +
      `and hitPullRate >= guildAverage + ${thresholds.minimumAbsoluteRateDelta}. This flags a difference worth discussing — it is not proof of a mistake.`
  )
  lines.push('')
  lines.push('## Mechanic summaries')
  for (const summary of mechanicSummaries) {
    lines.push(`### ${summary.mechanicLabel}`)
    lines.push(`- Classification: **${summary.classification}** — ${summary.summaryText}`)
    lines.push(
      `- Coverage: ${summary.includedFights}/${summary.matchedFights} matched pulls included (${summary.includedFightPercent.toFixed(1)}%); ` +
        `${Math.round(summary.eligiblePullCoverage * 100)}% of included pulls had at least one eligible player`
    )
    if (summary.reviewCandidateEvaluationNote) {
      lines.push(`- **${summary.reviewCandidateEvaluationNote}**`)
    }
    lines.push(
      `- Players eligible: ${summary.playersEligible}, players hit at least once: ${summary.playersWithAtLeastOneHit} ` +
        `(${Math.round(summary.shareOfEligiblePlayersWithHit * 100)}%)`
    )
    lines.push(`- Top 3 players account for ${Math.round(summary.topThreePlayersHitShare * 100)}% of hit-pulls`)
    lines.push(`- Guild average hit-pull rate: ${(summary.guildAverageHitPullRate * 100).toFixed(1)}%`)
    lines.push(`- Review candidates: ${summary.classification === 'insufficientData' ? 'not evaluated (insufficient data)' : summary.reviewCandidateCount}`)
    lines.push('')
  }
  lines.push('## Known limitations')
  lines.push(
    '- Alive-for-mechanic eligibility is approximated from recorded deaths and does not account for combat resurrection.\n' +
      '- Manual report codes are trusted as given; encounter/difficulty are still verified against each report.\n' +
      '- Player identity is matched by name (case-insensitive) across reports, since WCL actor IDs are report-local.\n' +
      '- Cross-report duplicate detection uses a conservative fingerprint (start time, duration, kill/wipe outcome, boss ' +
      "percentage, roster overlap) and does not inspect mechanic events themselves — it can miss duplicates whose " +
      'fingerprints legitimately differ, and never merges on duration alone.'
  )
  if (warnings.length > 0) {
    lines.push('')
    lines.push('## Warnings from this run')
    for (const warning of warnings) lines.push(`- ${warning}`)
  }
  return lines.join('\n')
}
