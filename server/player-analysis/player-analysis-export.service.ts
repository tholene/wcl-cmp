import crypto from 'node:crypto'
import { queryWclGraphQl } from '../warcraft-logs/wcl-client'
import type { WclConfig } from '../warcraft-logs/wcl-config'
import { WclService } from '../warcraft-logs/wcl-service'
import { clampLimits } from './player-analysis-limits'
import { JobStore } from './player-analysis-job-store'
import {
  fetchDamageDoneEvents,
  fetchDamageTakenEvents,
  fetchCastEvents,
  fetchBuffEvents,
  fetchDebuffEvents,
  fetchHealingEvents,
  fetchDeathEvents,
  fetchCombatantInfoEvents,
  fetchInterruptEvents,
  fetchDispelEvents,
  fetchResourceEvents,
  type RawEvent,
} from './player-analysis-event-fetchers'
import {
  buildCsvFile,
  FIGHTS_CSV_HEADERS,
  COMBATANT_INFO_CSV_HEADERS,
  DAMAGE_DONE_CSV_HEADERS,
  DAMAGE_TAKEN_CSV_HEADERS,
  CASTS_CSV_HEADERS,
  BUFFS_CSV_HEADERS,
  DEBUFFS_CSV_HEADERS,
  HEALING_CSV_HEADERS,
  DEATHS_CSV_HEADERS,
  INTERRUPTS_CSV_HEADERS,
  DISPELS_CSV_HEADERS,
  RESOURCES_CSV_HEADERS,
  COMPARISON_SUMMARY_CSV_HEADERS,
} from './player-analysis-csv'
import {
  ensureExportDir,
  writeExportFile,
  writeExportJsonFile,
  createBundleZip,
  getExportFileSize,
} from './player-analysis-export-files'
import { WOW_SPEC_MAP } from './wow-spec-map'
import type {
  PlayerAnalysisExportRequest,
  PlayerAnalysisExportPreview,
  PlayerAnalysisExportStartResponse,
  PlayerAnalysisExportFile,
  PlayerAnalysisExportView,
  PlayerAnalysisTimeframePreset,
  PlayerDetectedContext,
  NormalizedBenchmarkCandidate,
  PlayerBenchmarkCandidatesRequest,
} from './player-analysis.types'

// ---------------------------------------------------------------------------
// Report players query (minimal — re-used from wcl-service pattern)
// ---------------------------------------------------------------------------

type ReportPlayersQueryResponse = {
  reportData?: {
    report?: {
      masterData?: {
        actors?: Array<{
          id: number
          name?: string | null
          type?: string | null
          subType?: string | null
          icon?: string | null
        }>
      } | null
    } | null
  }
}

const REPORT_PLAYERS_QUERY = `
  query ReportPlayers($code: String!) {
    reportData {
      report(code: $code) {
        masterData(translate: true) {
          actors {
            id
            name
            type
            subType
            icon
          }
        }
      }
    }
  }
`

// ---------------------------------------------------------------------------
// Timeframe resolution
// ---------------------------------------------------------------------------

function resolveTimeframe(
  preset?: PlayerAnalysisTimeframePreset,
  since?: number,
  until?: number
): { since: number | undefined; until: number | undefined } {
  const nowMs = Date.now()

  if (!preset || preset === 'manualReports') {
    return { since, until }
  }

  if (preset === 'last7Days') {
    return { since: nowMs - 7 * 24 * 60 * 60 * 1000, until: nowMs }
  }

  if (preset === 'last14Days') {
    return { since: nowMs - 14 * 24 * 60 * 60 * 1000, until: nowMs }
  }

  if (preset === 'previousCalendarWeek') {
    const now = new Date()
    const dayOfWeek = now.getUTCDay() // 0=Sun, 1=Mon...
    const daysSinceMonday = (dayOfWeek + 6) % 7
    const thisMonday = new Date(now)
    thisMonday.setUTCDate(now.getUTCDate() - daysSinceMonday)
    thisMonday.setUTCHours(0, 0, 0, 0)
    const lastMonday = new Date(thisMonday)
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7)
    const lastSunday = new Date(thisMonday)
    lastSunday.setUTCMilliseconds(-1)
    return { since: lastMonday.getTime(), until: lastSunday.getTime() }
  }

  return { since, until }
}

// ---------------------------------------------------------------------------
// Player actor lookup
// ---------------------------------------------------------------------------

type ActorInfo = {
  id: number
  name: string
  className: string | null
}

async function findPlayerInReport(config: WclConfig, code: string, playerName: string): Promise<ActorInfo | null> {
  try {
    const response = await queryWclGraphQl<ReportPlayersQueryResponse>({
      config,
      query: REPORT_PLAYERS_QUERY,
      variables: { code },
    })
    const actors = response.reportData?.report?.masterData?.actors ?? []
    const match = actors.find(
      (actor) => actor.type === 'Player' && actor.name?.toLowerCase() === playerName.toLowerCase()
    )
    if (!match) return null
    return {
      id: match.id,
      name: match.name ?? playerName,
      className: match.subType ?? null,
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Combatant info extraction
// ---------------------------------------------------------------------------

type CombatantDetails = {
  specId: number | null
  specName: string | null
  role: 'tank' | 'healer' | 'dps' | null
  itemLevel: number | null
  talentsJson: string
  gearJson: string
  rawJson: string
}

function extractCombatantDetails(events: RawEvent[], sourceId: number): CombatantDetails {
  const event = events.find((e) => e.sourceID === sourceId || (e as { sourceId?: number }).sourceId === sourceId)
  if (!event) {
    return { specId: null, specName: null, role: null, itemLevel: null, talentsJson: '[]', gearJson: '[]', rawJson: '{}' }
  }

  const gear = Array.isArray(event.gear) ? event.gear : []
  const ilvls = gear
    .map((item) => (typeof item === 'object' && item !== null ? (item as Record<string, unknown>).itemLevel : null))
    .filter((v): v is number => typeof v === 'number' && v > 0)
  const avgIlvl = ilvls.length > 0 ? Math.round(ilvls.reduce((a, b) => a + b, 0) / ilvls.length) : null

  const specId = typeof (event as Record<string, unknown>).specID === 'number'
    ? (event as Record<string, unknown>).specID as number
    : null
  const specInfo = specId !== null ? (WOW_SPEC_MAP[specId] ?? null) : null

  return {
    specId,
    specName: specInfo?.specName ?? null,
    role: specInfo?.role ?? null,
    itemLevel: avgIlvl,
    talentsJson: JSON.stringify(event.talentTree ?? event.auras ?? []),
    gearJson: JSON.stringify(gear),
    rawJson: JSON.stringify(event),
  }
}

// ---------------------------------------------------------------------------
// View label for status messages
// ---------------------------------------------------------------------------

const VIEW_LABELS: Record<PlayerAnalysisExportView, string> = {
  fightMetadata: 'Fight metadata',
  combatantInfo: 'Combatant info',
  damageDone: 'Damage done',
  damageTaken: 'Damage taken',
  casts: 'Casts',
  buffs: 'Buffs',
  debuffs: 'Debuffs',
  healing: 'Healing',
  deaths: 'Deaths',
  interrupts: 'Interrupts',
  dispels: 'Dispels',
  resources: 'Resources',
}

// ---------------------------------------------------------------------------
// CSV filename by view
// ---------------------------------------------------------------------------

function csvFilename(view: PlayerAnalysisExportView, subject: 'player' | 'benchmark'): string {
  const prefix = subject === 'benchmark' ? 'benchmark' : 'player'
  const names: Record<PlayerAnalysisExportView, string> = {
    fightMetadata: 'fights',
    combatantInfo: 'combatant-info',
    damageDone: 'damage-done',
    damageTaken: 'damage-taken',
    casts: 'casts',
    buffs: 'buffs',
    debuffs: 'debuffs',
    healing: 'healing',
    deaths: 'deaths',
    interrupts: 'interrupts',
    dispels: 'dispels',
    resources: 'resources',
  }
  return `${prefix}-${names[view]}.csv`
}

// ---------------------------------------------------------------------------
// README builder
// ---------------------------------------------------------------------------

function buildReadme(params: {
  exportId: string
  playerName: string
  className: string
  specName: string
  itemLevel: number | null
  scope: PlayerAnalysisExportPreview['scope']
  views: PlayerAnalysisExportView[]
  benchmarkEnabled: boolean
  benchmarkMode: string
  benchmarkWarnings: string[]
  warnings: string[]
  detectedContext?: PlayerDetectedContext
  userContext?: { role?: string; className?: string; specName?: string }
}): string {
  const scope = params.scope
  const dc = params.detectedContext
  const uc = params.userContext

  const detectedLines =
    dc && dc.confidence === 'high'
      ? [
          `- Source: ${dc.source}${dc.specId ? ` (specID ${dc.specId})` : ''}`,
          `- Confidence: high`,
          `- Class: ${dc.className ?? 'unknown'}`,
          `- Spec: ${dc.specName ?? 'unknown'}`,
          `- Role: ${dc.role?.toUpperCase() ?? 'unknown'}`,
        ]
      : dc && dc.confidence === 'medium'
        ? [
            `- Source: ${dc.source}`,
            `- Confidence: medium`,
            `- Class: ${dc.className ?? 'unknown'}`,
            `- Spec: not detected`,
            `- Role: not detected`,
          ]
        : ['- Source: unavailable', '- Confidence: low', '- Class: unknown', '- Spec: unknown', '- Role: unknown']

  const benchmarkClass = dc?.confidence === 'high' ? (dc.className ?? 'unknown') : (uc?.className ?? 'unknown')
  const benchmarkSpec = dc?.confidence === 'high' ? (dc.specName ?? 'unknown') : (uc?.specName ?? 'unknown')
  const benchmarkRole = dc?.confidence === 'high' ? (dc.role?.toUpperCase() ?? 'unknown') : (uc?.role?.toUpperCase() ?? 'unknown')
  const benchmarkSource = dc?.confidence === 'high' ? 'WCL-detected' : uc?.className ? 'user-provided' : 'unavailable'

  const lines: string[] = [
    '# Player Analysis Export',
    '',
    '## Player',
    `- Requested player: ${params.playerName}`,
    `- Item level: ${params.itemLevel ?? 'unknown'}`,
    '',
    '## Player context (WCL-detected)',
    ...detectedLines,
    '',
    '## Player context (user-provided)',
    `- Class: ${uc?.className ?? '(not provided)'}`,
    `- Spec: ${uc?.specName ?? '(not provided)'}`,
    `- Role: ${uc?.role?.toUpperCase() ?? '(not provided)'}`,
    '',
    '## Benchmark context used',
    `- Class: ${benchmarkClass} (${benchmarkSource})`,
    `- Spec: ${benchmarkSpec} (${benchmarkSource})`,
    `- Role: ${benchmarkRole} (${benchmarkSource})`,
    '- Note: Benchmark will only be marked valid if class and spec match.',
    '',
    '## Scope',
    `- Timeframe preset: ${scope.timeframePreset ?? 'manual'}`,
    `- Reports scanned: ${scope.reportsScanned}`,
    `- Reports included: ${scope.reportsIncluded}`,
    `- Fights scanned: ${scope.fightsScanned}`,
    `- Fights included: ${scope.fightsIncluded}`,
    `- Only player-present fights: ${scope.onlyPlayerPresent ? 'yes' : 'no'}`,
    '',
    '## Benchmark',
    `- Enabled: ${params.benchmarkEnabled ? 'yes' : 'no'}`,
    `- Mode: ${params.benchmarkMode}`,
    ...(params.benchmarkEnabled && params.benchmarkWarnings.length
      ? params.benchmarkWarnings.map((w) => `- Warning: ${w}`)
      : []),
    '',
    '## Files',
    '- `manifest.json` — export metadata',
    '- `player-fights.csv` — one row per included fight',
    '- `player-combatant-info.csv` — gear/talents where WCL returns them',
    ...params.views
      .filter((v) => v !== 'fightMetadata' && v !== 'combatantInfo')
      .map((v) => `- \`player-${csvFilename(v, 'player').replace('player-', '')}\` — ${VIEW_LABELS[v]} events`),
    ...(params.benchmarkEnabled ? ['- `benchmark-*.csv` — same views for benchmark player'] : []),
    ...(params.benchmarkEnabled ? ['- `comparison-summary.csv` — numeric diff table'] : []),
    '- `bundle.zip` — all files bundled',
    '',
    '## Important caveats',
    '- This export is evidence, not a verdict.',
    '- Do not compare across different specs.',
    '- Kill time, assignments, talents, gear, externals, PI/aug buffs, deaths, and strategy can skew comparisons.',
    '- Absence from a fight is not poor performance.',
    '- Unknown role/spec/class means unknown; do not guess.',
    '',
    '## Warnings',
    ...(params.warnings.length ? params.warnings.map((w) => `- ${w}`) : ['None']),
    '',
    '## Optional analysis prompt',
    '',
    'Analyze the attached Player Analysis Export. Compare the player to the benchmark data only where the benchmark is the same class and spec. Look for improvement opportunities across damage profile, casts, cooldown usage, buff uptime, debuff uptime, resources, target selection, mechanics, survivability, utility, consumables, and consistency. Separate strong evidence from tentative conclusions. Do not assume role/spec/class if marked unknown.',
  ]
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Export preview (sync, no event data)
// ---------------------------------------------------------------------------

export async function getExportPreview(
  config: WclConfig,
  request: PlayerAnalysisExportRequest
): Promise<PlayerAnalysisExportPreview> {
  const playerName = request.playerName?.trim()
  if (!playerName) throw new Error('Missing playerName')

  const { limits, warnings: limitWarnings } = clampLimits(request.limits)
  const warnings: string[] = [...limitWarnings]

  const { since, until } = resolveTimeframe(request.timeframePreset, request.since, request.until)

  let reportCodes: string[]
  if (request.reportCodes?.length) {
    reportCodes = request.reportCodes.slice(0, limits.maxReports)
  } else {
    const recentReports = await WclService.listRecentReports(config, limits.maxReports)
    reportCodes = recentReports
      .filter((r) => {
        if (since !== undefined && r.startTime < since) return false
        if (until !== undefined && r.startTime > until) return false
        return true
      })
      .map((r) => r.code)
  }

  if (reportCodes.length > limits.maxReports) {
    warnings.push(`Reports clamped from ${reportCodes.length} to ${limits.maxReports}`)
    reportCodes = reportCodes.slice(0, limits.maxReports)
  }

  const includeKills = request.includeKills ?? true
  const includeWipes = request.includeWipes ?? true
  const includeTrash = request.includeTrash ?? false
  const onlyPlayerPresent = request.onlyPlayerPresent ?? true

  const includedReports: PlayerAnalysisExportPreview['includedReports'] = []
  let reportsIncluded = 0
  let fightsScanned = 0
  let fightsIncluded = 0

  const sourceIdsByReport: Record<string, number[]> = {}
  let detectedClassName: string | null = null
  let firstPlayerFight: { code: string; fightId: number; startTime: number; endTime: number; sourceId: number } | null = null

  const reportResults = await Promise.allSettled(
    reportCodes.map((code) => WclService.getReportDetails(config, code))
  )

  for (const result of reportResults) {
    if (result.status === 'rejected') continue
    const report = result.value
    const actor = await findPlayerInReport(config, report.code, playerName)
    const playerPresent = actor !== null

    if (actor && !detectedClassName && actor.className) {
      detectedClassName = actor.className
    }
    if (actor) {
      sourceIdsByReport[report.code] = [actor.id]
    }

    const includedFights: PlayerAnalysisExportPreview['includedReports'][0]['includedFights'] = []
    const skippedFights: PlayerAnalysisExportPreview['includedReports'][0]['skippedFights'] = []

    for (const fight of report.fights) {
      fightsScanned += 1

      if (!includeTrash && fight.encounterId <= 0) {
        skippedFights.push({ fightId: fight.id, encounterName: fight.encounterName, reason: 'trash fight excluded' })
        continue
      }
      if (fight.kill && !includeKills) {
        skippedFights.push({ fightId: fight.id, encounterName: fight.encounterName, reason: 'kills excluded' })
        continue
      }
      if (!fight.kill && !includeWipes) {
        skippedFights.push({ fightId: fight.id, encounterName: fight.encounterName, reason: 'wipes excluded' })
        continue
      }
      if (onlyPlayerPresent && !playerPresent) {
        skippedFights.push({ fightId: fight.id, encounterName: fight.encounterName, reason: 'player not present' })
        continue
      }

      if (fightsIncluded >= limits.maxFights) {
        skippedFights.push({ fightId: fight.id, encounterName: fight.encounterName, reason: 'fight limit reached' })
        continue
      }

      includedFights.push({
        fightId: fight.id,
        encounterId: fight.encounterId,
        encounterName: fight.encounterName,
        kill: fight.kill,
        difficulty: fight.difficulty,
        durationMs: Math.max(fight.endTime - fight.startTime, 0),
        playerPresent,
      })
      fightsIncluded += 1

      if (!firstPlayerFight && playerPresent && actor) {
        firstPlayerFight = {
          code: report.code,
          fightId: fight.id,
          startTime: fight.startTime,
          endTime: fight.endTime,
          sourceId: actor.id,
        }
      }
    }

    if (includedFights.length > 0) reportsIncluded += 1

    includedReports.push({
      code: report.code,
      title: report.title,
      url: report.url,
      startTime: report.startTime,
      playerPresent,
      includedFights,
      skippedFights,
    })
  }

  // Spec detection: one CombatantInfo fetch for the first player-present fight
  let detectedContext: PlayerDetectedContext = { source: 'unknown', confidence: 'low' }

  if (firstPlayerFight) {
    try {
      const combatantResult = await fetchCombatantInfoEvents({
        config,
        code: firstPlayerFight.code,
        fightId: firstPlayerFight.fightId,
        startTime: firstPlayerFight.startTime,
        endTime: firstPlayerFight.endTime,
        maxEvents: 50,
      })
      const details = extractCombatantDetails(combatantResult.events, firstPlayerFight.sourceId)
      if (details.specId !== null && details.specName !== null) {
        detectedContext = {
          specId: details.specId,
          className: WOW_SPEC_MAP[details.specId]?.className,
          specName: details.specName,
          role: details.role ?? undefined,
          source: 'wclCombatantInfo',
          confidence: 'high',
        }
      } else if (detectedClassName) {
        detectedContext = { className: detectedClassName, source: 'wclActor', confidence: 'medium' }
      }
    } catch {
      // Non-fatal — fall through to wclActor or unknown
    }
  }

  if (detectedContext.confidence === 'low' && detectedClassName) {
    detectedContext = { className: detectedClassName, source: 'wclActor', confidence: 'medium' }
  }

  const userCtx = request.playerContext
  if (userCtx && detectedContext.confidence === 'high') {
    const classConflict = userCtx.className && userCtx.className.toLowerCase() !== (detectedContext.className ?? '').toLowerCase()
    const specConflict = userCtx.specName && userCtx.specName.toLowerCase() !== (detectedContext.specName ?? '').toLowerCase()
    const roleConflict = userCtx.role && userCtx.role !== detectedContext.role
    if (classConflict || specConflict || roleConflict) {
      warnings.push('User-provided context differs from WCL-detected context. Using WCL-detected context for benchmark matching.')
    }
  }

  const estimatedCsvFiles = request.views.length + (request.includeBenchmark ? request.views.length + 1 : 0)
  const estimatedSizeLevel: 'small' | 'medium' | 'large' | 'veryLarge' =
    fightsIncluded > 45 ? 'veryLarge' : fightsIncluded > 20 ? 'large' : fightsIncluded > 8 ? 'medium' : 'small'

  return {
    requestedPlayerName: playerName,
    scope: {
      timeframePreset: request.timeframePreset,
      since,
      until,
      reportsScanned: reportCodes.length,
      reportsIncluded,
      fightsScanned,
      fightsIncluded,
      onlyPlayerPresent,
    },
    detectedPlayer: {
      characterName: playerName,
      className: detectedContext.className ?? detectedClassName ?? 'unknown',
      specName: detectedContext.specName ?? 'unknown',
      role: detectedContext.role ?? 'unknown',
      itemLevel: null,
      sourceIdsByReport,
      detectedContext,
      specId: detectedContext.specId,
      warnings: detectedContext.className ? [] : [`Class not found for ${playerName} in scanned reports`],
    },
    includedReports,
    estimatedExport: {
      views: request.views,
      estimatedCsvFiles,
      estimatedSizeLevel,
      warnings: [],
    },
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Event rows builders
// ---------------------------------------------------------------------------

type FightContext = {
  exportId: string
  subjectType: 'player' | 'benchmark'
  reportCode: string
  reportTitle: string
  fightId: number
  encounterId: number
  encounterName: string
  difficulty: number
  kill: boolean
  fightDurationMs: number
  fightStartTime: number // report-relative ms, for computing relative timestamps
}

function buildEventBaseRow(ctx: FightContext, event: RawEvent, actorById: Map<number, { name?: string | null }>) {
  const ts = typeof event.timestamp === 'number' ? event.timestamp : ctx.fightStartTime
  return {
    exportId: ctx.exportId,
    subjectType: ctx.subjectType,
    reportCode: ctx.reportCode,
    reportTitle: ctx.reportTitle,
    fightId: ctx.fightId,
    encounterId: ctx.encounterId,
    encounterName: ctx.encounterName,
    difficulty: ctx.difficulty,
    kill: ctx.kill,
    fightDurationMs: ctx.fightDurationMs,
    sourceId: event.sourceID ?? '',
    sourceName: actorById.get(event.sourceID ?? -1)?.name ?? '',
    targetId: event.targetID ?? '',
    targetName: actorById.get(event.targetID ?? -1)?.name ?? '',
    abilityGameId: event.ability?.gameID ?? '',
    abilityName: event.ability?.name ?? '',
    timestampMs: ts,
    relativeTimestampMs: Math.max(0, Math.floor(ts - ctx.fightStartTime)),
    eventType: event.type ?? '',
  }
}

// ---------------------------------------------------------------------------
// Export job: start (sync, returns immediately)
// ---------------------------------------------------------------------------

export function startExportJob(config: WclConfig, request: PlayerAnalysisExportRequest): PlayerAnalysisExportStartResponse {
  const exportId = crypto.randomUUID()

  // Estimate total steps: report scanning + (fights × views) + benchmark + write + zip
  const estimatedFights = Math.min(
    request.limits?.maxFights ?? 30,
    30
  )
  const viewCount = request.views.length
  const benchmarkSteps = request.includeBenchmark
    ? request.benchmark?.manualTarget
      ? viewCount + 2
      : request.benchmark?.autoConfig
        ? viewCount + 3
        : 0
    : 0
  const totalSteps = 2 + estimatedFights * viewCount + benchmarkSteps + 3 // scan + fights + benchmark + write/zip

  JobStore.create(exportId, totalSteps)

  setImmediate(() => {
    runExportJob(config, request, exportId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unexpected export error'
      JobStore.fail(exportId, message)
    })
  })

  return {
    exportId,
    status: 'queued',
    statusUrl: `/api/player-analysis/exports/${exportId}/status`,
  }
}

// ---------------------------------------------------------------------------
// Export job: async runner (background, never touches HTTP response)
// ---------------------------------------------------------------------------

async function getActorMap(config: WclConfig, code: string): Promise<Map<number, { name?: string | null; subType?: string | null }>> {
  try {
    const response = await queryWclGraphQl<ReportPlayersQueryResponse>({
      config,
      query: REPORT_PLAYERS_QUERY,
      variables: { code },
    })
    const actors = response.reportData?.report?.masterData?.actors ?? []
    const map = new Map<number, { name?: string | null; subType?: string | null }>()
    actors.forEach((a) => { if (a.id > 0) map.set(a.id, a) })
    return map
  } catch {
    return new Map()
  }
}

async function runExportJob(
  config: WclConfig,
  request: PlayerAnalysisExportRequest,
  exportId: string
): Promise<void> {
  const playerName = request.playerName.trim()
  const allWarnings: string[] = []
  const { limits } = clampLimits(request.limits)

  JobStore.setStep(exportId, 'Preparing export...', { playerName })

  // Re-derive scope (same logic as preview)
  const preview = await getExportPreview(config, request)
  allWarnings.push(...preview.warnings)

  JobStore.setStep(exportId, 'Setting up export directory...')
  ensureExportDir(exportId)

  // Row accumulators per view
  const playerRows: Record<PlayerAnalysisExportView, Record<string, unknown>[]> = {} as Record<PlayerAnalysisExportView, Record<string, unknown>[]>
  const benchmarkRows: Record<PlayerAnalysisExportView, Record<string, unknown>[]> = {} as Record<PlayerAnalysisExportView, Record<string, unknown>[]>
  for (const view of request.views) {
    playerRows[view] = []
    benchmarkRows[view] = []
  }

  const fightRows: Record<string, unknown>[] = []
  const combatantRows: Record<string, unknown>[] = []

  // Process each included fight
  for (const reportPreview of preview.includedReports) {
    const actorMap = await getActorMap(config, reportPreview.code)
    const reportDetails = await WclService.getReportDetails(config, reportPreview.code).catch(() => null)
    if (!reportDetails) {
      allWarnings.push(`Could not load report details for ${reportPreview.code}`)
      continue
    }

    for (const fightPreview of reportPreview.includedFights) {
      const fight = reportDetails.fights.find((f) => f.id === fightPreview.fightId)
      if (!fight) continue

      const fightDurationMs = Math.max(fight.endTime - fight.startTime, 0)
      const playerActor = reportPreview.playerPresent
        ? actorMap.get(preview.detectedPlayer?.sourceIdsByReport[reportPreview.code]?.[0] ?? -1) ?? null
        : null

      const ctx: FightContext = {
        exportId,
        subjectType: 'player',
        reportCode: reportPreview.code,
        reportTitle: reportDetails.title,
        fightId: fight.id,
        encounterId: fight.encounterId,
        encounterName: fight.encounterName,
        difficulty: fight.difficulty,
        kill: fight.kill,
        fightDurationMs,
        fightStartTime: fight.startTime,
      }

      // Always add fight metadata row
      let combatantItemLevel: number | null = null
      let combatantSpecName: string | null = null
      let combatantRole: string | null = null

      const sourceId = preview.detectedPlayer?.sourceIdsByReport[reportPreview.code]?.[0]

      // CombatantInfo (for both fightMetadata and combatantInfo views)
      if (request.views.includes('combatantInfo') || request.views.includes('fightMetadata')) {
        JobStore.setStep(exportId, `Fetching ${playerName} — ${VIEW_LABELS['combatantInfo']}...`, {
          reportCode: reportPreview.code,
          fightId: fight.id,
          view: 'combatantInfo',
          playerName,
        })
        const combatantResult = await fetchCombatantInfoEvents({
          config,
          code: reportPreview.code,
          fightId: fight.id,
          startTime: fight.startTime,
          endTime: fight.endTime,
          maxEvents: 50,
        })
        allWarnings.push(...combatantResult.warnings)

        if (request.views.includes('combatantInfo') && sourceId) {
          const details = extractCombatantDetails(combatantResult.events, sourceId)
          combatantItemLevel = details.itemLevel
          combatantSpecName = details.specName
          combatantRole = details.role

          combatantRows.push({
            subjectType: 'player',
            reportCode: reportPreview.code,
            fightId: fight.id,
            sourceName: playerActor?.name ?? playerName,
            sourceId: sourceId ?? '',
            className: preview.detectedPlayer?.className ?? 'unknown',
            specName: details.specName ?? 'unknown',
            role: details.role ?? 'unknown',
            itemLevel: details.itemLevel ?? '',
            talentsJson: details.talentsJson,
            gearJson: details.gearJson,
            rawJson: details.rawJson,
          })
        }
        if (request.views.includes('combatantInfo')) JobStore.advance(exportId)
      }

      fightRows.push({
        subjectType: 'player',
        reportCode: reportPreview.code,
        reportTitle: reportDetails.title,
        fightId: fight.id,
        encounterId: fight.encounterId,
        encounterName: fight.encounterName,
        difficulty: fight.difficulty,
        kill: fight.kill,
        startTime: reportDetails.startTime + fight.startTime,
        endTime: reportDetails.startTime + fight.endTime,
        durationMs: fightDurationMs,
        playerPresent: fightPreview.playerPresent,
        sourceName: playerActor?.name ?? playerName,
        sourceId: sourceId ?? '',
        className: preview.detectedPlayer?.className ?? 'unknown',
        specName: combatantSpecName ?? preview.detectedPlayer?.specName ?? 'unknown',
        role: combatantRole ?? preview.detectedPlayer?.role ?? 'unknown',
        itemLevel: combatantItemLevel ?? '',
        wclReportUrl: `https://www.warcraftlogs.com/reports/${reportPreview.code}#fight=${fight.id}`,
      })

      if (!fightPreview.playerPresent || !sourceId) {
        allWarnings.push(`Player ${playerName} not present in fight ${fight.id} of ${reportPreview.code} — event views skipped`)
        JobStore.advance(exportId)
        continue
      }

      // Per-view event fetching
      for (const view of request.views) {
        if (view === 'fightMetadata' || view === 'combatantInfo') {
          if (view === 'fightMetadata') JobStore.advance(exportId)
          continue
        }

        JobStore.setStep(exportId, `Fetching ${playerName} — ${VIEW_LABELS[view]}...`, {
          reportCode: reportPreview.code,
          fightId: fight.id,
          view,
          playerName,
        })

        const fetchParams = {
          config,
          code: reportPreview.code,
          fightId: fight.id,
          startTime: fight.startTime,
          endTime: fight.endTime,
          sourceId,
          targetId: sourceId,
          maxEvents: limits.maxEventsPerFightPerView,
        }

        let result = { events: [] as RawEvent[], truncated: false, warnings: [] as string[] }

        if (view === 'damageDone') result = await fetchDamageDoneEvents(fetchParams)
        else if (view === 'damageTaken') result = await fetchDamageTakenEvents({ ...fetchParams, sourceId: undefined })
        else if (view === 'casts') result = await fetchCastEvents({ ...fetchParams, targetId: undefined })
        else if (view === 'buffs') result = await fetchBuffEvents({ ...fetchParams, targetId: undefined })
        else if (view === 'debuffs') result = await fetchDebuffEvents({ ...fetchParams, targetId: undefined })
        else if (view === 'healing') result = await fetchHealingEvents({ ...fetchParams, targetId: undefined })
        else if (view === 'deaths') {
          const allDeaths = await fetchDeathEvents({ ...fetchParams, sourceId: undefined, targetId: undefined })
          result = {
            ...allDeaths,
            events: allDeaths.events.filter((e) => e.targetID === sourceId),
          }
        }
        else if (view === 'interrupts') result = await fetchInterruptEvents({ ...fetchParams, targetId: undefined })
        else if (view === 'dispels') result = await fetchDispelEvents({ ...fetchParams, targetId: undefined })
        else if (view === 'resources') result = await fetchResourceEvents({ ...fetchParams, targetId: undefined })

        allWarnings.push(...result.warnings)

        // Map events to CSV rows
        for (const event of result.events) {
          const base = buildEventBaseRow(ctx, event, actorMap as Map<number, { name?: string | null }>)

          if (view === 'deaths') {
            // Find pre-death damage window (10s before death)
            const deathTs = typeof event.timestamp === 'number' ? event.timestamp : 0
            playerRows[view].push({
              ...base,
              deathTimestampMs: deathTs,
              deathRelativeTimestampMs: Math.max(0, Math.floor(deathTs - fight.startTime)),
              killingBlowAbility: event.ability?.name ?? '',
              killingBlowSource: base.sourceName,
              lastDamageEventsJson: '[]', // pre-death window requires separate query; stub
              rawJson: JSON.stringify(event),
            })
          } else {
            playerRows[view].push({
              ...base,
              amount: event.amount ?? '',
              absorbed: event.absorbed ?? '',
              overkill: event.overkill ?? '',
              overheal: event.overheal ?? '',
            })
          }
        }

        JobStore.advance(exportId)
      }
    }
  }

  // Benchmark
  let benchmarkEnabled = false
  let benchmarkWarnings: string[] = []
  let benchmarkCandidate: Record<string, unknown> | null = null
  const benchmarkCandidatesPerFight: Array<{
    encounterId: number
    difficulty: number
    candidates: NormalizedBenchmarkCandidate[]
    selected?: NormalizedBenchmarkCandidate
    warnings: string[]
  }> = []

  if (request.includeBenchmark && request.benchmark?.manualTarget) {
    const { PlayerAnalysisBenchmarkService } = await import('./player-analysis-benchmark.service')
    JobStore.setStep(exportId, 'Fetching benchmark player data...')
    const benchmarkResult = await PlayerAnalysisBenchmarkService.fetchManualBenchmarkTarget(
      config,
      request.benchmark.manualTarget,
      preview.detectedPlayer?.className ?? null,
    )
    benchmarkWarnings = benchmarkResult.warnings
    allWarnings.push(...benchmarkWarnings)
    benchmarkCandidate = benchmarkResult.candidate as Record<string, unknown>

    if (benchmarkResult.fight && benchmarkResult.sourceId) {
      const benchFight = benchmarkResult.fight
      const benchReportCode = request.benchmark.manualTarget.reportCode
      const benchActorMap = await getActorMap(config, benchReportCode)
      const benchReportDetails = await WclService.getReportDetails(config, benchReportCode).catch(() => null)

      const benchCtx: FightContext = {
        exportId,
        subjectType: 'benchmark',
        reportCode: benchReportCode,
        reportTitle: benchReportDetails?.title ?? benchReportCode,
        fightId: benchFight.fightId,
        encounterId: benchFight.encounterId,
        encounterName: benchFight.encounterName,
        difficulty: benchFight.difficulty,
        kill: benchFight.kill,
        fightDurationMs: benchFight.durationMs,
        fightStartTime: benchFight.startTime,
      }

      for (const view of request.views) {
        if (view === 'fightMetadata' || view === 'combatantInfo') continue

        JobStore.setStep(exportId, `Fetching benchmark — ${VIEW_LABELS[view]}...`, { view })

        const fetchParams = {
          config,
          code: benchReportCode,
          fightId: benchFight.fightId,
          startTime: benchFight.startTime,
          endTime: benchFight.startTime + benchFight.durationMs,
          sourceId: benchmarkResult.sourceId,
          targetId: benchmarkResult.sourceId,
          maxEvents: limits.maxEventsPerFightPerView,
        }

        let result = { events: [] as RawEvent[], truncated: false, warnings: [] as string[] }

        if (view === 'damageDone') result = await fetchDamageDoneEvents(fetchParams)
        else if (view === 'damageTaken') result = await fetchDamageTakenEvents({ ...fetchParams, sourceId: undefined })
        else if (view === 'casts') result = await fetchCastEvents({ ...fetchParams, targetId: undefined })
        else if (view === 'buffs') result = await fetchBuffEvents({ ...fetchParams, targetId: undefined })
        else if (view === 'healing') result = await fetchHealingEvents({ ...fetchParams, targetId: undefined })
        else if (view === 'deaths') {
          const allDeaths = await fetchDeathEvents({ ...fetchParams, sourceId: undefined, targetId: undefined })
          result = { ...allDeaths, events: allDeaths.events.filter((e) => e.targetID === benchmarkResult.sourceId) }
        }

        allWarnings.push(...result.warnings)

        for (const event of result.events) {
          const base = buildEventBaseRow(benchCtx, event, benchActorMap as Map<number, { name?: string | null }>)
          benchmarkRows[view].push({
            ...base,
            amount: event.amount ?? '',
            absorbed: event.absorbed ?? '',
            overkill: event.overkill ?? '',
            overheal: event.overheal ?? '',
          })
        }

        JobStore.advance(exportId)
      }

      benchmarkEnabled = true
    }
  } else if (request.includeBenchmark && request.benchmark?.autoConfig) {
    const { PlayerAnalysisBenchmarkService } = await import('./player-analysis-benchmark.service')
    const autoConfig = request.benchmark.autoConfig
    const playerClassName = preview.detectedPlayer?.className
    const playerSpecName = preview.detectedPlayer?.specName

    if (!playerClassName || playerClassName === 'unknown' || !playerSpecName || playerSpecName === 'unknown') {
      allWarnings.push(
        'Automated benchmark discovery skipped — player class/spec could not be detected. Use manual benchmark mode or ensure the player appears in at least one CombatantInfo event.'
      )
    } else {
      // Collect unique encounter+difficulty combos from included fights
      const seenEncounterKeys = new Set<string>()
      const fightContextsForBenchmark: Array<{
        encounterId: number
        difficulty: number
        durationMs: number
        encounterName: string
      }> = []
      for (const reportPreview of preview.includedReports) {
        for (const f of reportPreview.includedFights) {
          const key = `${f.encounterId ?? 0}:${f.difficulty}`
          if (!seenEncounterKeys.has(key) && (f.encounterId ?? 0) > 0) {
            seenEncounterKeys.add(key)
            fightContextsForBenchmark.push({
              encounterId: f.encounterId ?? 0,
              difficulty: f.difficulty,
              durationMs: f.durationMs,
              encounterName: f.encounterName,
            })
          }
        }
      }

      JobStore.setStep(exportId, 'Discovering benchmark candidates...')

      let apiSupportedOverall = true
      for (const fightCtx of fightContextsForBenchmark) {
        const candidateRequest: PlayerBenchmarkCandidatesRequest = {
          playerName,
          encounterId: fightCtx.encounterId,
          encounterName: fightCtx.encounterName,
          difficulty: fightCtx.difficulty,
          className: playerClassName,
          specName: playerSpecName,
          itemLevel: null,
          durationMs: fightCtx.durationMs,
          targetPercentile: autoConfig.targetPercentile,
          metric: autoConfig.metric,
          maxCandidates: autoConfig.maxCandidates ?? 10,
          itemLevelWindow: autoConfig.itemLevelWindow,
          killDurationWindowPct: autoConfig.durationWindowPercent,
        }

        const candidateResult = await PlayerAnalysisBenchmarkService.findBenchmarkCandidates(config, candidateRequest)

        benchmarkCandidatesPerFight.push({
          encounterId: fightCtx.encounterId,
          difficulty: fightCtx.difficulty,
          candidates: candidateResult.candidates,
          selected: candidateResult.selectedCandidate,
          warnings: candidateResult.warnings,
        })

        if (!candidateResult.apiSupported) {
          allWarnings.push(`WCL characterRankings API not supported for encounter ${fightCtx.encounterId} — auto benchmark disabled.`)
          apiSupportedOverall = false
          break
        }
      }

      if (apiSupportedOverall) {
        // Select the first encounter that has a usable candidate
        const usableEntry = benchmarkCandidatesPerFight.find((e) => e.selected?.validation.hasUsableExportTarget)
        const selectedCandidate = usableEntry?.selected

        if (selectedCandidate?.reportCode && typeof selectedCandidate.fightId === 'number') {
          const benchReportCode = selectedCandidate.reportCode
          const benchFightId = selectedCandidate.fightId

          const benchReportDetails = await WclService.getReportDetails(config, benchReportCode).catch(() => null)
          if (!benchReportDetails) {
            allWarnings.push(`Could not load benchmark report ${benchReportCode} — benchmark data will not be included.`)
          } else {
            const benchFightDetails = benchReportDetails.fights.find((f) => f.id === benchFightId)
            if (!benchFightDetails) {
              allWarnings.push(`Fight ${benchFightId} not found in benchmark report ${benchReportCode} — benchmark data will not be included.`)
            } else {
              // Find the benchmark player actor by character name
              const benchActorMap = await getActorMap(config, benchReportCode)
              const benchActors = await queryWclGraphQl<ReportPlayersQueryResponse>({
                config,
                query: REPORT_PLAYERS_QUERY,
                variables: { code: benchReportCode },
              }).catch(() => null)

              const actors = benchActors?.reportData?.report?.masterData?.actors ?? []
              const benchActor = actors.find(
                (a) => a.type === 'Player' && a.name?.toLowerCase() === selectedCandidate.characterName.toLowerCase()
              )

              if (!benchActor) {
                allWarnings.push(`Could not find player "${selectedCandidate.characterName}" in benchmark report ${benchReportCode} — benchmark data will not be included.`)
              } else {
                const benchSourceId = benchActor.id
                const benchDurationMs = Math.max(benchFightDetails.endTime - benchFightDetails.startTime, 0)

                const benchCtx: FightContext = {
                  exportId,
                  subjectType: 'benchmark',
                  reportCode: benchReportCode,
                  reportTitle: benchReportDetails.title ?? benchReportCode,
                  fightId: benchFightId,
                  encounterId: benchFightDetails.encounterId,
                  encounterName: benchFightDetails.encounterName,
                  difficulty: benchFightDetails.difficulty,
                  kill: benchFightDetails.kill,
                  fightDurationMs: benchDurationMs,
                  fightStartTime: benchFightDetails.startTime,
                }

                for (const view of request.views) {
                  if (view === 'fightMetadata' || view === 'combatantInfo') continue

                  JobStore.setStep(exportId, `Fetching benchmark — ${VIEW_LABELS[view]}...`, { view })

                  const fetchParams = {
                    config,
                    code: benchReportCode,
                    fightId: benchFightId,
                    startTime: benchFightDetails.startTime,
                    endTime: benchFightDetails.endTime,
                    sourceId: benchSourceId,
                    targetId: benchSourceId,
                    maxEvents: limits.maxEventsPerFightPerView,
                  }

                  let result = { events: [] as RawEvent[], truncated: false, warnings: [] as string[] }

                  if (view === 'damageDone') result = await fetchDamageDoneEvents(fetchParams)
                  else if (view === 'damageTaken') result = await fetchDamageTakenEvents({ ...fetchParams, sourceId: undefined })
                  else if (view === 'casts') result = await fetchCastEvents({ ...fetchParams, targetId: undefined })
                  else if (view === 'buffs') result = await fetchBuffEvents({ ...fetchParams, targetId: undefined })
                  else if (view === 'healing') result = await fetchHealingEvents({ ...fetchParams, targetId: undefined })
                  else if (view === 'deaths') {
                    const allDeaths = await fetchDeathEvents({ ...fetchParams, sourceId: undefined, targetId: undefined })
                    result = { ...allDeaths, events: allDeaths.events.filter((e) => e.targetID === benchSourceId) }
                  }

                  allWarnings.push(...result.warnings)

                  for (const event of result.events) {
                    const base = buildEventBaseRow(benchCtx, event, benchActorMap as Map<number, { name?: string | null }>)
                    benchmarkRows[view].push({
                      ...base,
                      amount: event.amount ?? '',
                      absorbed: event.absorbed ?? '',
                      overkill: event.overkill ?? '',
                      overheal: event.overheal ?? '',
                    })
                  }

                  JobStore.advance(exportId)
                }

                benchmarkEnabled = true
                benchmarkWarnings = allWarnings.filter((w) => w.toLowerCase().includes('benchmark'))
              }
            }
          }
        } else {
          allWarnings.push('No usable benchmark candidate found with a valid report code and fight ID — benchmark data will not be included.')
        }
      }
    }
  }

  // Write CSV files
  JobStore.setStep(exportId, 'Writing CSV files...')

  const writtenFiles: PlayerAnalysisExportFile[] = []

  // fights.csv
  if (request.views.includes('fightMetadata')) {
    const content = buildCsvFile(FIGHTS_CSV_HEADERS, fightRows)
    const { sizeBytes } = writeExportFile(exportId, 'player-fights.csv', content)
    writtenFiles.push({ filename: 'player-fights.csv', kind: 'csv', view: 'fightMetadata', sizeBytes, rowCount: fightRows.length, downloadUrl: `/api/player-analysis/exports/${exportId}/player-fights.csv` })
  }

  // combatant-info.csv
  if (request.views.includes('combatantInfo')) {
    const content = buildCsvFile(COMBATANT_INFO_CSV_HEADERS, combatantRows)
    const { sizeBytes } = writeExportFile(exportId, 'player-combatant-info.csv', content)
    writtenFiles.push({ filename: 'player-combatant-info.csv', kind: 'csv', view: 'combatantInfo', sizeBytes, rowCount: combatantRows.length, downloadUrl: `/api/player-analysis/exports/${exportId}/player-combatant-info.csv` })
  }

  const VIEW_HEADERS: Partial<Record<PlayerAnalysisExportView, string[]>> = {
    damageDone: DAMAGE_DONE_CSV_HEADERS,
    damageTaken: DAMAGE_TAKEN_CSV_HEADERS,
    casts: CASTS_CSV_HEADERS,
    buffs: BUFFS_CSV_HEADERS,
    debuffs: DEBUFFS_CSV_HEADERS,
    healing: HEALING_CSV_HEADERS,
    deaths: DEATHS_CSV_HEADERS,
    interrupts: INTERRUPTS_CSV_HEADERS,
    dispels: DISPELS_CSV_HEADERS,
    resources: RESOURCES_CSV_HEADERS,
  }

  for (const view of request.views) {
    if (view === 'fightMetadata' || view === 'combatantInfo') continue
    const headers = VIEW_HEADERS[view]
    if (!headers) continue
    const rows = playerRows[view]
    const filename = csvFilename(view, 'player')
    const content = buildCsvFile(headers, rows)
    const { sizeBytes } = writeExportFile(exportId, filename, content)
    writtenFiles.push({ filename, kind: 'csv', view, sizeBytes, rowCount: rows.length, downloadUrl: `/api/player-analysis/exports/${exportId}/${filename}` })

    if (benchmarkEnabled) {
      const benchRows = benchmarkRows[view]
      const benchFilename = csvFilename(view, 'benchmark')
      const benchContent = buildCsvFile(headers, benchRows)
      const { sizeBytes: benchSize } = writeExportFile(exportId, benchFilename, benchContent)
      writtenFiles.push({ filename: benchFilename, kind: 'benchmarkCsv', view, sizeBytes: benchSize, rowCount: benchRows.length, downloadUrl: `/api/player-analysis/exports/${exportId}/${benchFilename}` })
    }
  }

  // comparison-summary.csv + benchmark metadata file
  if (benchmarkEnabled) {
    if (request.benchmark?.autoConfig) {
      writeExportJsonFile(exportId, 'benchmark-candidates.json', {
        mode: 'automatic',
        targetPercentile: request.benchmark.autoConfig.targetPercentile,
        metric: request.benchmark.autoConfig.metric,
        fightContexts: benchmarkCandidatesPerFight,
      })
      writtenFiles.push({ filename: 'benchmark-candidates.json', kind: 'benchmarkJson', sizeBytes: getExportFileSize(exportId, 'benchmark-candidates.json'), downloadUrl: `/api/player-analysis/exports/${exportId}/benchmark-candidates.json` })
    } else {
      writeExportJsonFile(exportId, 'benchmark-candidate.json', benchmarkCandidate)
      writtenFiles.push({ filename: 'benchmark-candidate.json', kind: 'benchmarkJson', sizeBytes: getExportFileSize(exportId, 'benchmark-candidate.json'), downloadUrl: `/api/player-analysis/exports/${exportId}/benchmark-candidate.json` })
    }

    const comparisonRows = buildComparisonSummary(playerRows, benchmarkRows, request.views)
    const compContent = buildCsvFile(COMPARISON_SUMMARY_CSV_HEADERS, comparisonRows)
    const { sizeBytes: compSize } = writeExportFile(exportId, 'comparison-summary.csv', compContent)
    writtenFiles.push({ filename: 'comparison-summary.csv', kind: 'csv', sizeBytes: compSize, rowCount: comparisonRows.length, downloadUrl: `/api/player-analysis/exports/${exportId}/comparison-summary.csv` })
  }

  // Write manifest + README
  JobStore.setStep(exportId, 'Writing manifest and README...')

  const manifest = {
    exportId,
    createdAt: new Date().toISOString(),
    playerName,
    views: request.views,
    scope: preview.scope,
    detectedContext: preview.detectedPlayer?.detectedContext ?? null,
    userContext: request.playerContext ?? null,
    benchmarkEnabled,
    benchmarkMode: benchmarkEnabled ? (request.benchmark?.autoConfig ? 'automatic' : 'manual') : 'none',
    warnings: allWarnings,
    files: writtenFiles.map((f) => f.filename),
  }
  writeExportJsonFile(exportId, 'manifest.json', manifest)
  writtenFiles.unshift({
    filename: 'manifest.json',
    kind: 'manifest',
    sizeBytes: getExportFileSize(exportId, 'manifest.json'),
    downloadUrl: `/api/player-analysis/exports/${exportId}/manifest.json`,
  })

  const readme = buildReadme({
    exportId,
    playerName,
    className: preview.detectedPlayer?.className ?? 'unknown',
    specName: preview.detectedPlayer?.specName ?? 'unknown',
    itemLevel: null,
    scope: preview.scope,
    views: request.views,
    benchmarkEnabled,
    benchmarkMode: benchmarkEnabled ? (request.benchmark?.autoConfig ? 'automatic' : 'manual') : 'none',
    benchmarkWarnings,
    warnings: allWarnings,
    detectedContext: preview.detectedPlayer?.detectedContext,
    userContext: request.playerContext,
  })
  writeExportFile(exportId, 'README.md', readme)
  writtenFiles.push({
    filename: 'README.md',
    kind: 'readme',
    sizeBytes: getExportFileSize(exportId, 'README.md'),
    downloadUrl: `/api/player-analysis/exports/${exportId}/README.md`,
  })

  // Create zip
  JobStore.setStep(exportId, 'Creating ZIP bundle...')
  const allFilenames = writtenFiles.map((f) => f.filename)
  const { sizeBytes: zipSize } = await createBundleZip(exportId, allFilenames)
  writtenFiles.push({
    filename: 'bundle.zip',
    kind: 'zip',
    sizeBytes: zipSize,
    downloadUrl: `/api/player-analysis/exports/${exportId}/bundle.zip`,
  })

  const hasWarnings = allWarnings.length > 0
  if (hasWarnings) {
    JobStore.partial(exportId, writtenFiles, allWarnings)
  } else {
    JobStore.complete(exportId, writtenFiles)
  }
}

// ---------------------------------------------------------------------------
// Comparison summary builder
// ---------------------------------------------------------------------------

function buildComparisonSummary(
  playerRows: Record<PlayerAnalysisExportView, Record<string, unknown>[]>,
  benchmarkRows: Record<PlayerAnalysisExportView, Record<string, unknown>[]>,
  views: PlayerAnalysisExportView[]
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []

  const sumField = (records: Record<string, unknown>[], field: string): number =>
    records.reduce((total, row) => total + (Number(row[field]) || 0), 0)

  const diff = (player: number, benchmark: number) => {
    const difference = player - benchmark
    const differencePct = benchmark !== 0 ? Number(((difference / benchmark) * 100).toFixed(1)) : null
    return { difference, differencePct }
  }

  if (views.includes('damageDone')) {
    const playerTotal = sumField(playerRows.damageDone, 'amount')
    const benchTotal = sumField(benchmarkRows.damageDone, 'amount')
    const { difference, differencePct } = diff(playerTotal, benchTotal)
    rows.push({ category: 'damage', metric: 'totalDamage', playerValue: playerTotal, benchmarkValue: benchTotal, difference, differencePct, notes: '' })
    rows.push({ category: 'damage', metric: 'castCount', playerValue: playerRows.damageDone.length, benchmarkValue: benchmarkRows.damageDone.length, ...diff(playerRows.damageDone.length, benchmarkRows.damageDone.length), notes: '' })
  }

  if (views.includes('healing')) {
    const playerTotal = sumField(playerRows.healing, 'amount')
    const benchTotal = sumField(benchmarkRows.healing, 'amount')
    rows.push({ category: 'healing', metric: 'totalHealing', playerValue: playerTotal, benchmarkValue: benchTotal, ...diff(playerTotal, benchTotal), notes: 'Healing comparison requires same spec context' })
  }

  if (views.includes('casts')) {
    rows.push({ category: 'casts', metric: 'totalCasts', playerValue: playerRows.casts.length, benchmarkValue: benchmarkRows.casts.length, ...diff(playerRows.casts.length, benchmarkRows.casts.length), notes: '' })
  }

  if (views.includes('deaths')) {
    rows.push({ category: 'survivability', metric: 'deaths', playerValue: playerRows.deaths.length, benchmarkValue: benchmarkRows.deaths.length, ...diff(playerRows.deaths.length, benchmarkRows.deaths.length), notes: 'Lower is better' })
  }

  if (views.includes('damageTaken')) {
    const playerTotal = sumField(playerRows.damageTaken, 'amount')
    const benchTotal = sumField(benchmarkRows.damageTaken, 'amount')
    rows.push({ category: 'damageTaken', metric: 'totalDamageTaken', playerValue: playerTotal, benchmarkValue: benchTotal, ...diff(playerTotal, benchTotal), notes: 'Context required; tanks will differ' })
  }

  return rows
}
