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
import {
  enrichWclEvent,
  buildActorMapFromList,
  buildAbilityMapsFromList,
  computeDataQuality,
  type DataQualityStats,
  type ActorMap,
  type AbilityMaps,
} from './player-analysis-event-enrichment'
import { WOW_SPEC_MAP } from './wow-spec-map'
import type {
  PlayerAnalysisBenchmarkSkippedCandidate,
  PlayerAnalysisBenchmarkSummary,
  PlayerAnalysisExportRequest,
  PlayerAnalysisExportPreview,
  PlayerAnalysisExportStartResponse,
  PlayerAnalysisExportFile,
  PlayerAnalysisExportView,
  PlayerAnalysisTimeframePreset,
  PlayerDetectedContext,
  PlayerUserContext,
  EffectivePlayerContext,
  SelectedBenchmarkCandidate,
  PlayerAnalysisViewSummary,
  PlayerAnalysisWarningGroupKey,
  PlayerAnalysisWarningGroups,
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
          petOwner?: number | null
        }>
        abilities?: Array<Record<string, unknown>>
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
            petOwner
          }
          abilities {
            gameID
            name
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

  if (!preset || preset === 'manualReports' || preset === 'latestRaid') {
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

const KNOWN_RAID_ZONE_IDS = new Set<number>([
  26, // Castle Nathria
  27, // Sanctum of Domination
  28, // Sepulcher of the First Ones
  31, // Vault of the Incarnates
  33, // Aberrus, the Shadowed Crucible
  35, // Amirdrassil, the Dream's Hope
  38, // Nerub-ar Palace
])

const KNOWN_RAID_ZONE_NAMES = new Set<string>([
  'castle nathria',
  'sanctum of domination',
  'sepulcher of the first ones',
  'vault of the incarnates',
  'aberrus, the shadowed crucible',
  "amirdrassil, the dream's hope",
  'nerub-ar palace',
])

const RAID_NAME_HINTS = ['raid', 'palace', 'vault', 'sanctum', 'sepulcher', 'aberrus', 'amirdrassil', 'nathria']
const NON_RAID_NAME_HINTS = [
  'mythic+',
  'mythic plus',
  'dungeon',
  'keystone',
  'timewalking',
  'arena',
  'battleground',
  'skirmish',
]

function normalizeZoneName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

function isRaidZone(report: { zoneId?: number | null; zoneName?: string | null }): boolean {
  if (typeof report.zoneId === 'number' && KNOWN_RAID_ZONE_IDS.has(report.zoneId)) return true
  const zoneName = normalizeZoneName(report.zoneName)
  if (!zoneName) return false
  if (KNOWN_RAID_ZONE_NAMES.has(zoneName)) return true
  if (NON_RAID_NAME_HINTS.some((hint) => zoneName.includes(hint))) return false
  return RAID_NAME_HINTS.some((hint) => zoneName.includes(hint))
}

async function selectLatestRaidReportCodesForPlayer(
  config: WclConfig,
  reports: Array<{ code: string; startTime: number; zoneId?: number | null; zoneName?: string | null }>,
  playerName: string
): Promise<string[]> {
  if (reports.length === 0) return []

  const raidReports = reports.filter(isRaidZone).sort((left, right) => right.startTime - left.startTime)
  if (raidReports.length === 0) return []

  const withPresence = await Promise.all(
    raidReports.map(async (report) => {
      const actor = await findPlayerInReport(config, report.code, playerName)
      return {
        report,
        playerPresent: actor !== null,
      }
    })
  )

  const playerRaidReports = withPresence.filter((entry) => entry.playerPresent).map((entry) => entry.report)
  if (playerRaidReports.length === 0) return []

  const latest = playerRaidReports[0]
  const latestZone = normalizeZoneName(latest.zoneName)
  const maxWindowMs = 6 * 60 * 60 * 1000

  return playerRaidReports
    .filter((report) => {
      if (latest.startTime - report.startTime > maxWindowMs) return false
      if (!latestZone) return true
      const zone = normalizeZoneName(report.zoneName)
      return !!zone && zone === latestZone
    })
    .map((report) => report.code)
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

function coalesceKnownItemLevel(current: number | null, next: number | null | undefined): number | null {
  if (typeof current === 'number') return current
  if (typeof next === 'number') return next
  return null
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

function buildContextWarnings(
  detectedContext: PlayerDetectedContext,
  userContext?: PlayerUserContext | null
): string[] {
  if (!userContext) return []
  const warnings: string[] = []
  const hasDetectedClass = !!detectedContext.className
  const hasDetectedSpec = !!detectedContext.specName
  const hasDetectedRole = !!detectedContext.role

  if (hasDetectedClass && userContext.className &&
    userContext.className.toLowerCase() !== detectedContext.className!.toLowerCase()) {
    warnings.push(`User-provided class ${userContext.className} differs from WCL-detected ${detectedContext.className}.`)
  }
  if (hasDetectedSpec && userContext.specName &&
    userContext.specName.toLowerCase() !== detectedContext.specName!.toLowerCase()) {
    warnings.push(`User-provided spec ${userContext.specName} differs from WCL-detected ${detectedContext.specName}.`)
  }
  if (hasDetectedRole && userContext.role && userContext.role !== detectedContext.role) {
    warnings.push(
      `User-provided role ${userContext.role.toUpperCase()} differs from WCL-detected ${detectedContext.role!.toUpperCase()}.`
    )
  }

  return warnings
}

function resolveEffectiveContext(
  detectedContext: PlayerDetectedContext,
  userContext?: PlayerUserContext | null,
  benchmarkContextSource?: 'wclDetected' | 'userProvided'
): EffectivePlayerContext {
  const hasDetectedClassSpec = !!detectedContext.className && !!detectedContext.specName
  const hasUserClassSpec = !!userContext?.className && !!userContext?.specName

  if (benchmarkContextSource === 'userProvided') {
    if (hasUserClassSpec) {
      return {
        className: userContext?.className,
        specName: userContext?.specName,
        role: userContext?.role ?? 'unknown',
        source: 'userProvided',
      }
    }
    return { source: 'unknown', role: 'unknown' }
  }

  if (hasDetectedClassSpec) {
    return {
      className: detectedContext.className,
      specName: detectedContext.specName,
      role: detectedContext.role ?? 'unknown',
      source: 'wclDetected',
    }
  }

  if (hasUserClassSpec) {
    return {
      className: userContext?.className,
      specName: userContext?.specName,
      role: userContext?.role ?? 'unknown',
      source: 'userProvided',
    }
  }

  return { source: 'unknown', role: 'unknown' }
}

function toNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isHiddenOrPrivateName(name: string | undefined | null): boolean {
  if (!name) return true
  const normalized = name.trim().toLowerCase()
  if (!normalized) return true
  return (
    normalized === 'anonymous' ||
    normalized === 'unknown' ||
    normalized === 'hidden' ||
    normalized === 'private' ||
    normalized === 'redacted' ||
    normalized === 'unavailable' ||
    normalized.startsWith('anonymous ') ||
    normalized.startsWith('hidden ')
  )
}

function isExportableSelectedCandidate(candidate: SelectedBenchmarkCandidate): boolean {
  const benchmarkPlayerName = toNonEmptyString(candidate.benchmarkPlayerName)
  if (!benchmarkPlayerName || isHiddenOrPrivateName(benchmarkPlayerName)) return false
  if (!toNonEmptyString(candidate.benchmarkReportCode)) return false
  if (!Number.isInteger(candidate.benchmarkFightId) || candidate.benchmarkFightId <= 0) return false
  if (!toNonEmptyString(candidate.baselineReportCode)) return false
  if (!Number.isInteger(candidate.baselineFightId) || candidate.baselineFightId <= 0) return false
  return true
}

export type ExportBenchmarkValidationResult = {
  benchmarkRequested: boolean
  benchmarkMode: 'auto' | 'manual' | 'none'
  allowSubjectOnlyWithoutBenchmark: boolean
  exportableSelectedCandidates: SelectedBenchmarkCandidate[]
  manualTarget: { reportCode: string; fightId: number; playerName: string } | null
  blockedReason: string | null
}

export function validateExportBenchmarkRequest(
  request: PlayerAnalysisExportRequest
): ExportBenchmarkValidationResult {
  const benchmark = request.benchmark
  const benchmarkRequested = benchmark?.requested === true
  if (!benchmarkRequested) {
    return {
      benchmarkRequested: false,
      benchmarkMode: 'none',
      allowSubjectOnlyWithoutBenchmark: false,
      exportableSelectedCandidates: [],
      manualTarget: null,
      blockedReason: null,
    }
  }

  const allowSubjectOnlyWithoutBenchmark = benchmark?.allowSubjectOnlyWithoutBenchmark === true
  const benchmarkMode = benchmark?.mode === 'manual' ? 'manual' : benchmark?.mode === 'auto' ? 'auto' : 'none'

  if (benchmarkMode === 'none') {
    return {
      benchmarkRequested: true,
      benchmarkMode,
      allowSubjectOnlyWithoutBenchmark,
      exportableSelectedCandidates: [],
      manualTarget: null,
      blockedReason: 'Benchmark was requested, but benchmark.mode is missing or invalid.',
    }
  }

  if (benchmarkMode === 'manual') {
    const reportCode = toNonEmptyString(benchmark?.manualTarget?.reportCode)
    const playerName = toNonEmptyString(benchmark?.manualTarget?.playerName)
    const fightId = benchmark?.manualTarget?.fightId
    const hasFightId = Number.isInteger(fightId) && (fightId ?? 0) > 0
    const missing: string[] = []
    if (!reportCode) missing.push('reportCode')
    if (!hasFightId) missing.push('fightId')
    if (!playerName) missing.push('playerName')

    return {
      benchmarkRequested: true,
      benchmarkMode,
      allowSubjectOnlyWithoutBenchmark,
      exportableSelectedCandidates: [],
      manualTarget: reportCode && playerName && hasFightId
        ? { reportCode, fightId: fightId as number, playerName }
        : null,
      blockedReason:
        missing.length > 0
          ? `Manual benchmark target is incomplete: missing ${missing.join(', ')}.`
          : null,
    }
  }

  const selectedCandidates = Array.isArray(benchmark?.selectedCandidates) ? benchmark.selectedCandidates : []
  const exportableSelectedCandidates = selectedCandidates.filter(isExportableSelectedCandidate)
  const blockedReason =
    exportableSelectedCandidates.length > 0
      ? null
      : 'Auto benchmark requires at least one exportable selected candidate (non-hidden player name, report code, and fight ID).'

  return {
    benchmarkRequested: true,
    benchmarkMode,
    allowSubjectOnlyWithoutBenchmark,
    exportableSelectedCandidates,
    manualTarget: null,
    blockedReason,
  }
}

export function validateExportStartRequest(request: PlayerAnalysisExportRequest): void {
  const benchmarkValidation = validateExportBenchmarkRequest(request)
  if (
    benchmarkValidation.benchmarkRequested &&
    benchmarkValidation.blockedReason &&
    !benchmarkValidation.allowSubjectOnlyWithoutBenchmark
  ) {
    throw new Error(
      `${benchmarkValidation.blockedReason} Enable "Export subject-only data without benchmark comparison." to continue without benchmark files.`
    )
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
  subjectCombatantInfoItemLevel: number | null
  scope: PlayerAnalysisExportPreview['scope']
  views: PlayerAnalysisExportView[]
  benchmarkEnabled: boolean
  benchmarkMode: 'auto' | 'manual' | 'none'
  benchmarkWarnings: string[]
  benchmarkRequested: boolean
  benchmarkIncluded: boolean
  benchmarkRequestedButNotIncludedReason: string | null
  allowSubjectOnlyWithoutBenchmark: boolean
  selectedBenchmarkCandidates: Array<Record<string, unknown>>
  exportedBenchmarkCandidates: Array<Record<string, unknown>>
  skippedBenchmarkCandidates: Array<Record<string, unknown>>
  warnings: string[]
  detectedContext?: PlayerDetectedContext
  userContext?: PlayerUserContext | null
  effectiveContext?: EffectivePlayerContext
  contextWarnings?: string[]
  dataQuality?: DataQualityStats[]
  warningGroups?: PlayerAnalysisWarningGroups
  errors?: string[]
  benchmarkSummary?: PlayerAnalysisBenchmarkSummary
  viewSummary?: PlayerAnalysisViewSummary
  benchmarkItemLevelMismatches?: Array<{
    benchmarkPlayerName: string
    benchmarkReportCode: string
    benchmarkFightId: number
    benchmarkCandidateItemLevel: number
    benchmarkCombatantInfoItemLevel: number
    delta: number
  }>
}): string {
  const scope = params.scope
  const dc = params.detectedContext
  const uc = params.userContext
  const ec = params.effectiveContext

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

  const benchmarkClass = ec?.className ?? 'unknown'
  const benchmarkSpec = ec?.specName ?? 'unknown'
  const benchmarkRole = ec?.role ? ec.role.toUpperCase() : 'unknown'
  const benchmarkSource =
    ec?.source === 'wclDetected'
      ? 'WCL-detected'
      : ec?.source === 'userProvided'
        ? 'user-provided'
        : 'unknown'
  const benchmarkSourceReason =
    ec?.source === 'userProvided'
      ? (dc?.specName
        ? 'because user-selected benchmark context source is user-provided'
        : 'because WCL spec detection failed')
      : ec?.source === 'wclDetected'
        ? 'from WCL-detected context'
        : 'no class/spec context available'

  const lines: string[] = [
    '# Player Analysis Export Bundle',
    '',
    '## Purpose',
    '- This bundle captures Warcraft Logs evidence for one player and optional same-spec benchmark comparisons.',
    '- Use it to produce constructive, evidence-based coaching notes for officers.',
    '',
    '## AI Instructions',
    '- Report back in English.',
    '- Focus on actionable, benchmark-oriented coaching feedback.',
    '- Treat this bundle as evidence, not a verdict.',
    '- If data is missing or ambiguous, state assumptions and confidence clearly.',
    '- Use benchmark comparisons only when class/spec/encounter context matches.',
    '',
    'Required output structure:',
    '1. Executive summary',
    '2. Core findings (facts first)',
    '3. Deltas vs benchmark (only where valid)',
    '4. Practical recommendations for next raid',
    '5. Fight-by-fight notes',
    '6. Limitations and assumptions',
    '7. Concise player-facing message',
    '',
    '## Player',
    `- Requested player: ${params.playerName}`,
    `- Subject CombatantInfo item level: ${params.subjectCombatantInfoItemLevel ?? 'unknown'}`,
    '',
    '## Player Context',
    '',
    'WCL-detected:',
    ...detectedLines,
    '',
    'User-provided:',
    `- Class: ${uc?.className ?? '(not provided)'}`,
    `- Spec: ${uc?.specName ?? '(not provided)'}`,
    `- Role: ${uc?.role?.toUpperCase() ?? '(not provided)'}`,
    '',
    'Benchmark/export context used:',
    `- Class: ${benchmarkClass}`,
    `- Spec: ${benchmarkSpec}`,
    `- Role: ${benchmarkRole}`,
    `- Source: ${benchmarkSource} ${benchmarkSourceReason}`,
    '- Note: Benchmark will only be marked valid if class and spec match.',
    ...(params.contextWarnings?.length
      ? ['', 'Context warnings:', ...params.contextWarnings.map((warning) => `- ${warning}`)]
      : []),
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
    `- Requested: ${params.benchmarkRequested ? 'yes' : 'no'}`,
    `- Included: ${params.benchmarkIncluded ? 'yes' : 'no'}`,
    `- Mode: ${params.benchmarkMode}`,
    ...(params.benchmarkRequestedButNotIncludedReason
      ? [`- Reason: ${params.benchmarkRequestedButNotIncludedReason}`]
      : []),
    ...(params.allowSubjectOnlyWithoutBenchmark
      ? ['- Subject-only override: enabled']
      : []),
    ...(params.benchmarkRequested
      ? [
          `- Selected benchmark fights: ${params.selectedBenchmarkCandidates.length}`,
          `- Exported benchmark fights: ${params.exportedBenchmarkCandidates.length}`,
          `- Skipped benchmark fights: ${params.skippedBenchmarkCandidates.length}`,
        ]
      : []),
    ...(params.benchmarkIncluded && params.exportedBenchmarkCandidates.length > 0
      ? ['- Baseline to benchmark mapping:']
      : []),
    ...(params.benchmarkIncluded
      ? params.exportedBenchmarkCandidates.map((candidate) => {
          const baselineReportCode = String(candidate['baselineReportCode'] ?? '')
          const baselineFightId = String(candidate['baselineFightId'] ?? '')
          const benchmarkPlayerName = String(candidate['benchmarkPlayerName'] ?? candidate['playerName'] ?? '')
          const benchmarkReportCode = String(candidate['benchmarkReportCode'] ?? candidate['reportCode'] ?? '')
          const benchmarkFightId = String(candidate['benchmarkFightId'] ?? candidate['fightId'] ?? '')
          const rankingIlvl = candidate['benchmarkCandidateItemLevel'] ?? candidate['benchmarkItemLevel'] ?? 'unknown'
          const combatantIlvl = candidate['benchmarkCombatantInfoItemLevel'] ?? 'unknown'
          return `  - ${baselineReportCode}#${baselineFightId} -> ${benchmarkPlayerName} (${benchmarkReportCode}#${benchmarkFightId}) | ranking ilvl=${rankingIlvl}, combatantInfo ilvl=${combatantIlvl}`
        })
      : []),
    ...(params.benchmarkWarnings.length
      ? params.benchmarkWarnings.map((w) => `- Warning: ${w}`)
      : []),
    ...(params.benchmarkItemLevelMismatches && params.benchmarkItemLevelMismatches.length > 0
      ? [
          '- Item level mismatch checks (|ranking - combatantInfo| > 3):',
          ...params.benchmarkItemLevelMismatches.map(
            (item) =>
              `  - ${item.benchmarkPlayerName} (${item.benchmarkReportCode}#${item.benchmarkFightId}): ranking=${item.benchmarkCandidateItemLevel}, combatantInfo=${item.benchmarkCombatantInfoItemLevel}, delta=${item.delta}`
          ),
        ]
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
    ...(params.benchmarkEnabled ? ['- `comparison-summary.csv` — factual benchmark vs subject row/amount summary'] : []),
    '- `bundle.zip` — all files bundled',
    '',
    ...(params.dataQuality && params.dataQuality.length > 0
      ? [
          '## Data Quality',
          '',
          '| View | Rows | abilityGameId% | abilityName% | sourceName% | targetName% | rawEventJsonIncluded |',
          '|---|---|---|---|---|---|---|',
          ...params.dataQuality.map(
            (dq) =>
              `| ${dq.view} | ${dq.rowCount} | ${dq.abilityGameIdPct}% | ${dq.abilityNamePct}% | ${dq.sourceNamePct}% | ${dq.targetNamePct}% | ${dq.rawEventJsonIncluded} |`
          ),
          '',
          ...params.dataQuality
            .filter((dq) => dq.abilityNamePct < 50 && dq.totalRows > 0)
            .map((dq) => `Warning: ${dq.view} — only ${dq.abilityNamePct}% of rows have abilityName (${dq.lowAbilityNameReason ?? 'limited ability mapping coverage'}).`),
          '',
        ]
      : []),
    '## Important caveats',
    '- This export is evidence, not a verdict.',
    '- Do not compare across different specs.',
    '- Kill time, assignments, talents, gear, externals, PI/aug buffs, deaths, and strategy can skew comparisons.',
    '- Absence from a fight is not poor performance.',
    '- Unknown role/spec/class means unknown; do not guess.',
    ...(params.dataQuality && params.dataQuality.some((dq) => dq.abilityNamePct < 50 && dq.totalRows > 0)
      ? [
          '- Low ability-name coverage checks inspect event ability fields first, then report-level masterData abilities.',
        ]
      : []),
    '',
    '## Runtime Summary',
    `- Errors: ${params.errors?.length ?? 0}`,
    `- Requested views: ${params.viewSummary?.selectedViews.length ?? params.views.length}`,
    `- Exported subject views: ${params.viewSummary?.exportedViews.length ?? params.views.length}`,
    `- Skipped view outcomes: ${params.viewSummary?.skippedViews.length ?? 0}`,
    `- Truncated view outcomes: ${params.viewSummary?.truncatedViews.length ?? 0}`,
    ...(params.benchmarkSummary
      ? [
          `- Benchmark requested/included: ${params.benchmarkSummary.requested ? 'yes' : 'no'} / ${params.benchmarkSummary.included ? 'yes' : 'no'}`,
          `- Benchmark selected/exported/skipped candidates: ${params.benchmarkSummary.selectedCount}/${params.benchmarkSummary.exportedCount}/${params.benchmarkSummary.skippedCount}`,
          ...(params.benchmarkSummary.omittedReason ? [`- Benchmark omission reason: ${params.benchmarkSummary.omittedReason}`] : []),
        ]
      : []),
    ...(params.viewSummary && params.viewSummary.skippedViews.length > 0
      ? [
          '- Skipped views:',
          ...params.viewSummary.skippedViews.map(
            (entry) =>
              `  - ${entry.subjectType} ${VIEW_LABELS[entry.view]} (${entry.reportCode ?? 'n/a'}#${entry.fightId ?? 'n/a'}): ${entry.reason}`
          ),
        ]
      : []),
    ...(params.viewSummary && params.viewSummary.truncatedViews.length > 0
      ? [
          '- Truncated views:',
          ...params.viewSummary.truncatedViews.map(
            (entry) =>
              `  - ${entry.subjectType} ${VIEW_LABELS[entry.view]} (${entry.reportCode}#${entry.fightId}) capped at ${entry.rowLimit} rows.`
          ),
        ]
      : []),
    ...(params.benchmarkSummary && params.benchmarkSummary.skippedCandidates.length > 0
      ? [
          '- Skipped benchmark candidates:',
          ...params.benchmarkSummary.skippedCandidates.map(
            (candidate) =>
              `  - ${candidate.benchmarkPlayerName ?? 'unknown player'} (${candidate.benchmarkReportCode ?? 'n/a'}#${candidate.benchmarkFightId ?? 'n/a'}): ${candidate.reason}`
          ),
        ]
      : []),
    '',
    '## Warnings',
    ...(params.warnings.length ? params.warnings.map((w) => `- ${w}`) : ['None']),
    '',
    '### Warning Groups',
    ...(params.warningGroups && Object.keys(params.warningGroups).length > 0
      ? (Object.entries(params.warningGroups)
        .flatMap(([group, warnings]) => [
          `- ${group}:`,
          ...(warnings?.map((warning) => `  - ${warning}`) ?? ['  - none']),
        ]))
      : ['- none']),
    '',
    '### Errors',
    ...(params.errors && params.errors.length > 0 ? params.errors.map((error) => `- ${error}`) : ['None']),
    '',
    '## Optional analysis prompt',
    '',
    'Analyze this bundle in English. Compare the player to benchmark data only when same encounter/difficulty/class/spec is validated. Separate facts from interpretation and highlight assumptions.',
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
  const requestedFightIdsByReport = request.fightIdsByReport ?? {}

  let reportCodes: string[]
  if (request.reportCodes?.length) {
    reportCodes = request.reportCodes.slice(0, limits.maxReports)
  } else {
    const recentReports = await WclService.listRecentReports(config, limits.maxReports)
    if (request.timeframePreset === 'latestRaid') {
      reportCodes = await selectLatestRaidReportCodesForPlayer(config, recentReports, playerName)
      if (reportCodes.length === 0) {
        warnings.push(`No recent raid logs found where ${playerName} was present. Try manual report selection.`)
      }
    } else {
      reportCodes = recentReports
        .filter((r) => {
          if (since !== undefined && r.startTime < since) return false
          if (until !== undefined && r.startTime > until) return false
          return true
        })
        .map((r) => r.code)
    }
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
  let detectedItemLevel: number | null = null
  let firstPlayerFight: { code: string; fightId: number; startTime: number; endTime: number; sourceId: number } | null = null
  const specCandidateFights: Array<{
    code: string; fightId: number; startTime: number; endTime: number; sourceId: number
    isKill: boolean; durationMs: number
  }> = []

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
    const hasExplicitFightSelection = Object.prototype.hasOwnProperty.call(requestedFightIdsByReport, report.code)
    const selectedFightIds = new Set(
      (requestedFightIdsByReport[report.code] ?? [])
        .filter((fightId): fightId is number => Number.isFinite(fightId) && fightId > 0)
    )

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
      if (hasExplicitFightSelection && !selectedFightIds.has(fight.id)) {
        skippedFights.push({ fightId: fight.id, encounterName: fight.encounterName, reason: 'fight not selected' })
        continue
      }

      if (fightsIncluded >= limits.maxFights) {
        skippedFights.push({ fightId: fight.id, encounterName: fight.encounterName, reason: 'fight limit reached' })
        continue
      }

      const fightDurationMs = Math.max(fight.endTime - fight.startTime, 0)
      let presenceVerified: boolean | undefined
      let playerItemLevel: number | null | undefined

      if (fight.kill && fight.encounterId > 0) {
        presenceVerified = false
        playerItemLevel = null

        if (playerPresent && actor) {
          try {
            const combatantResult = await fetchCombatantInfoEvents({
              config,
              code: report.code,
              fightId: fight.id,
              startTime: fight.startTime,
              endTime: fight.endTime,
              maxEvents: 50,
            })
            const matchingCombatant = combatantResult.events.find(
              (event) => event.sourceID === actor.id || (event as { sourceId?: number }).sourceId === actor.id
            )
            if (matchingCombatant) {
              presenceVerified = true
              const details = extractCombatantDetails(combatantResult.events, actor.id)
              playerItemLevel = details.itemLevel
            }
          } catch {
            warnings.push(`CombatantInfo presence verification failed for ${report.code}#${fight.id}.`)
          }
        }
      }

      includedFights.push({
        fightId: fight.id,
        encounterId: fight.encounterId,
        encounterName: fight.encounterName,
        kill: fight.kill,
        difficulty: fight.difficulty,
        startTime: report.startTime + fight.startTime,
        durationMs: fightDurationMs,
        playerPresent,
        presenceVerified,
        playerItemLevel,
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

      if (playerPresent && actor && fight.encounterId > 0 && fightDurationMs >= 60000) {
        specCandidateFights.push({
          code: report.code,
          fightId: fight.id,
          startTime: fight.startTime,
          endTime: fight.endTime,
          sourceId: actor.id,
          isKill: fight.kill,
          durationMs: fightDurationMs,
        })
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

  // Spec detection: try multiple boss fights before giving up
  let detectedContext: PlayerDetectedContext = { source: 'unknown', confidence: 'low' }

  const diag = {
    fightsAttempted: 0,
    playerActorFound: detectedClassName !== null,
    actorId: firstPlayerFight?.sourceId,
    combatantInfoQueried: false,
    combatantInfoEventsFound: 0,
    matchingCombatantInfoFound: false,
    rawSpecIdFound: undefined as number | undefined,
    specIdMapped: false,
    checkedReportCode: undefined as string | undefined,
    checkedFightId: undefined as number | undefined,
  }

  // Sort: kills first, then by duration descending; cap at 5 attempts
  const sortedCandidates = specCandidateFights
    .sort((a, b) => (b.isKill ? 1 : 0) - (a.isKill ? 1 : 0) || b.durationMs - a.durationMs)
    .slice(0, 5)

  // Fallback to any player-present fight if no boss fights found
  if (sortedCandidates.length === 0 && firstPlayerFight) {
    sortedCandidates.push({ ...firstPlayerFight, isKill: false, durationMs: 0 })
  }

  for (const candidate of sortedCandidates) {
    diag.fightsAttempted += 1
    diag.checkedReportCode = candidate.code
    diag.checkedFightId = candidate.fightId
    try {
      const combatantResult = await fetchCombatantInfoEvents({
        config,
        code: candidate.code,
        fightId: candidate.fightId,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        maxEvents: 50,
      })
      diag.combatantInfoQueried = true
      diag.combatantInfoEventsFound += combatantResult.events.length
      const details = extractCombatantDetails(combatantResult.events, candidate.sourceId)
      detectedItemLevel = coalesceKnownItemLevel(detectedItemLevel, details.itemLevel)
      if (details.specId !== null) {
        diag.rawSpecIdFound = details.specId
        if (WOW_SPEC_MAP[details.specId]) {
          diag.specIdMapped = true
          diag.matchingCombatantInfoFound = true
          detectedContext = {
            specId: details.specId,
            className: WOW_SPEC_MAP[details.specId].className,
            specName: details.specName!,
            role: details.role ?? undefined,
            source: 'wclCombatantInfo',
            confidence: 'high',
          }
          break
        } else {
          warnings.push(`specID ${details.specId} found in ${candidate.code}#${candidate.fightId} but not in WOW_SPEC_MAP — spec remains unknown.`)
        }
      } else if (combatantResult.events.length > 0) {
        warnings.push(`CombatantInfo events found for ${candidate.code}#${candidate.fightId} but player sourceID ${candidate.sourceId} was not matched.`)
      } else {
        warnings.push(`CombatantInfo queried for ${candidate.code}#${candidate.fightId} but returned no events.`)
      }
    } catch {
      warnings.push(`CombatantInfo fetch failed for ${candidate.code}#${candidate.fightId}.`)
    }
  }

  if (detectedContext.confidence !== 'high') {
    if (detectedClassName) {
      detectedContext = { className: detectedClassName, source: 'wclActor', confidence: 'medium' }
      if (diag.fightsAttempted > 0) {
        warnings.push(`Only class "${detectedClassName}" could be detected from actor data; spec could not be determined from ${diag.fightsAttempted} fight(s) tried.`)
      }
    } else if (diag.fightsAttempted === 0) {
      warnings.push('No eligible boss fights found to attempt spec detection.')
    }
  }

  const userCtx = request.playerContext
  const contextWarnings = buildContextWarnings(detectedContext, userCtx)
  if (request.benchmarkContextSource === 'userProvided' && (!userCtx?.className || !userCtx?.specName)) {
    contextWarnings.push('User-provided benchmark context source selected, but class/spec is incomplete.')
  }
  warnings.push(...contextWarnings)
  const effectiveContext = resolveEffectiveContext(
    detectedContext,
    userCtx,
    request.benchmarkContextSource
  )

  const benchmarkValidation = validateExportBenchmarkRequest(request)
  const estimatedCsvFiles = request.views.length + (benchmarkValidation.benchmarkRequested ? request.views.length + 1 : 0)
  const estimatedSizeLevel: 'small' | 'medium' | 'large' | 'veryLarge' =
    fightsIncluded > 45 ? 'veryLarge' : fightsIncluded > 20 ? 'large' : fightsIncluded > 8 ? 'medium' : 'small'

  const recentRaidBossKillWarnings: string[] = []
  const unverifiedKillCount = includedReports.reduce(
    (total, report) =>
      total +
      report.includedFights.filter(
        (fight) => fight.kill && (fight.encounterId ?? 0) > 0 && fight.presenceVerified !== true
      ).length,
    0
  )
  if (unverifiedKillCount > 0) {
    recentRaidBossKillWarnings.push(
      `${unverifiedKillCount} boss kill fight(s) were hidden from the default boss list because player presence could not be verified per fight.`
    )
  }

  const recentRaidBossKillEntries = includedReports.flatMap((report) =>
    report.includedFights
      .filter((fight) => fight.kill && (fight.encounterId ?? 0) > 0 && fight.presenceVerified === true)
      .map((fight) => ({
        encounterId: fight.encounterId ?? 0,
        encounterName: fight.encounterName,
        difficulty: fight.difficulty,
        reportCode: report.code,
        reportTitle: report.title,
        reportUrl: report.url,
        fightId: fight.fightId,
        startTime: fight.startTime ?? report.startTime,
        durationMs: fight.durationMs,
        playerItemLevel: fight.playerItemLevel ?? null,
      }))
  )

  const recentRaidBossKillMap = new Map<
    string,
    {
      encounterId: number
      encounterName: string
      difficulty: number
      fights: Array<{
        reportCode: string
        reportTitle: string
        reportUrl: string
        fightId: number
        startTime: number
        durationMs: number
        playerItemLevel?: number | null
      }>
    }
  >()

  for (const fight of recentRaidBossKillEntries) {
    const key = `${fight.encounterId}:${fight.difficulty}`
    const existing = recentRaidBossKillMap.get(key)
    if (existing) {
      existing.fights.push({
        reportCode: fight.reportCode,
        reportTitle: fight.reportTitle,
        reportUrl: fight.reportUrl,
        fightId: fight.fightId,
        startTime: fight.startTime,
        durationMs: fight.durationMs,
        playerItemLevel: fight.playerItemLevel,
      })
      continue
    }
    recentRaidBossKillMap.set(key, {
      encounterId: fight.encounterId,
      encounterName: fight.encounterName,
      difficulty: fight.difficulty,
      fights: [
        {
          reportCode: fight.reportCode,
          reportTitle: fight.reportTitle,
          reportUrl: fight.reportUrl,
          fightId: fight.fightId,
          startTime: fight.startTime,
          durationMs: fight.durationMs,
          playerItemLevel: fight.playerItemLevel,
        },
      ],
    })
  }

  const recentRaidBossKills = {
    groups: Array.from(recentRaidBossKillMap.values())
      .map((group) => ({
        ...group,
        fights: [...group.fights].sort((left, right) => right.startTime - left.startTime),
      }))
      .sort((left, right) => {
        const leftLatest = left.fights[0]?.startTime ?? 0
        const rightLatest = right.fights[0]?.startTime ?? 0
        if (rightLatest !== leftLatest) return rightLatest - leftLatest
        return left.encounterName.localeCompare(right.encounterName)
      }),
    warnings: recentRaidBossKillWarnings,
  }

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
      itemLevel: detectedItemLevel,
      sourceIdsByReport,
      detectedContext,
      specId: detectedContext.specId,
      warnings: detectedContext.className ? [] : [`Class not found for ${playerName} in scanned reports.`],
      detectionDiagnostics: diag,
    },
    includedReports,
    recentRaidBossKills,
    estimatedExport: {
      views: request.views,
      estimatedCsvFiles,
      estimatedSizeLevel,
      warnings: [],
    },
    userContext: userCtx ?? null,
    effectiveContext,
    contextWarnings,
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

function fightContextFields(ctx: FightContext) {
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
  }
}

// ---------------------------------------------------------------------------
// Export job: start (sync, returns immediately)
// ---------------------------------------------------------------------------

export function startExportJob(config: WclConfig, request: PlayerAnalysisExportRequest): PlayerAnalysisExportStartResponse {
  validateExportStartRequest(request)
  const exportId = crypto.randomUUID()
  const benchmarkValidation = validateExportBenchmarkRequest(request)

  // Estimate total steps: report scanning + (fights × views) + benchmark + write + zip
  const estimatedFights = Math.min(
    request.limits?.maxFights ?? 30,
    30
  )
  const viewCount = request.views.length
  const selectedCandidateCount = benchmarkValidation.exportableSelectedCandidates.length
  const benchmarkSteps = benchmarkValidation.benchmarkRequested
    ? benchmarkValidation.benchmarkMode === 'manual'
      ? viewCount + 2
      : selectedCandidateCount * Math.max(0, viewCount)
    : 0
  const totalSteps = 2 + estimatedFights * viewCount + benchmarkSteps + 3 // scan + fights + benchmark + write/zip

  JobStore.create(exportId, totalSteps)

  setImmediate(() => {
    runExportJob(config, request, exportId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unexpected export error'
      JobStore.fail(exportId, message, {
        errors: [message],
        warningGroups: { runtimeApi: [message] },
        currentStep: 'Export failed.',
      })
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

async function getActorAndAbilityMaps(
  config: WclConfig,
  code: string
): Promise<{ actorMap: ActorMap; abilityMaps: AbilityMaps }> {
  try {
    const response = await queryWclGraphQl<ReportPlayersQueryResponse>({
      config,
      query: REPORT_PLAYERS_QUERY,
      variables: { code },
    })
    const actors = response.reportData?.report?.masterData?.actors ?? []
    const abilities = response.reportData?.report?.masterData?.abilities ?? []
    return {
      actorMap: buildActorMapFromList(actors),
      abilityMaps: buildAbilityMapsFromList(abilities),
    }
  } catch {
    return {
      actorMap: new Map(),
      abilityMaps: { byGameId: new Map(), byAbilityId: new Map() },
    }
  }
}

async function runExportJob(
  config: WclConfig,
  request: PlayerAnalysisExportRequest,
  exportId: string
): Promise<void> {
  const playerName = request.playerName.trim()
  const allWarnings: string[] = []
  const errors: string[] = []
  const warningGroups: PlayerAnalysisWarningGroups = {}
  const addGroupedWarning = (group: PlayerAnalysisWarningGroupKey, warning: string) => {
    allWarnings.push(warning)
    const current = warningGroups[group] ?? []
    current.push(warning)
    warningGroups[group] = current
  }
  const addError = (
    error: string,
    opts?: { group?: PlayerAnalysisWarningGroupKey; asWarning?: boolean }
  ) => {
    errors.push(error)
    if (opts?.asWarning !== false) {
      addGroupedWarning(opts?.group ?? 'runtimeApi', error)
    }
  }
  const partialReasons = new Set<string>()
  const markPartial = (reason: string) => partialReasons.add(reason)
  const skippedViews: PlayerAnalysisViewSummary['skippedViews'] = []
  const truncatedViews: PlayerAnalysisViewSummary['truncatedViews'] = []
  const selectedViews = Array.from(new Set(request.views))
  const exportedViews = new Set<PlayerAnalysisExportView>()
  const addViewSkip = (entry: PlayerAnalysisViewSummary['skippedViews'][number]) => {
    skippedViews.push(entry)
    markPartial(`Missing requested view data: ${entry.subjectType} ${VIEW_LABELS[entry.view]} (${entry.reason})`)
    addGroupedWarning(
      'viewFetch',
      `Skipped ${entry.subjectType} ${VIEW_LABELS[entry.view]} for ${entry.reportCode ?? 'unknown report'}#${entry.fightId ?? 'n/a'}: ${entry.reason}`
    )
  }
  const addViewTruncation = (entry: PlayerAnalysisViewSummary['truncatedViews'][number]) => {
    truncatedViews.push(entry)
    markPartial(`Truncated requested view: ${entry.subjectType} ${VIEW_LABELS[entry.view]}`)
    addGroupedWarning(
      'viewFetch',
      `Truncated ${entry.subjectType} ${VIEW_LABELS[entry.view]} for ${entry.reportCode}#${entry.fightId} at ${entry.rowLimit} rows.`
    )
  }
  const { limits } = clampLimits(request.limits)

  JobStore.setStep(exportId, 'Preparing export...', { playerName })

  // Re-derive scope (same logic as preview)
  const preview = await getExportPreview(config, request)
  for (const previewWarning of preview.warnings) {
    addGroupedWarning('dataQuality', previewWarning)
  }

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
  const benchmarkFightRows: Record<string, unknown>[] = []
  const benchmarkCombatantRows: Record<string, unknown>[] = []
  let subjectCombatantInfoItemLevel: number | null = null

  // Process each included fight
  for (const reportPreview of preview.includedReports) {
    const { actorMap, abilityMaps } = await getActorAndAbilityMaps(config, reportPreview.code)
    const reportDetails = await WclService.getReportDetails(config, reportPreview.code).catch(() => null)
    if (!reportDetails) {
      const warning = `Could not load report details for ${reportPreview.code}.`
      addGroupedWarning('runtimeApi', warning)
      addError(warning, { group: 'runtimeApi', asWarning: false })
      markPartial(`Report ${reportPreview.code} was selected but report details could not be loaded.`)
      for (const view of selectedViews) {
        addViewSkip({
          subjectType: 'player',
          view,
          reportCode: reportPreview.code,
          reason: 'report details unavailable',
        })
      }
      continue
    }

    for (const fightPreview of reportPreview.includedFights) {
      const fight = reportDetails.fights.find((f) => f.id === fightPreview.fightId)
      if (!fight) {
        markPartial(`Selected fight ${fightPreview.fightId} from ${reportPreview.code} was not found in report details.`)
        for (const view of selectedViews) {
          addViewSkip({
            subjectType: 'player',
            view,
            reportCode: reportPreview.code,
            fightId: fightPreview.fightId,
            reason: 'fight not found in report details',
          })
        }
        continue
      }

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
        for (const warning of combatantResult.warnings) {
          addGroupedWarning('viewFetch', warning)
        }
        const combatantUnavailable = combatantResult.warnings.find((warning) =>
          warning.toLowerCase().includes('not available')
        )
        if (combatantUnavailable) {
          addViewSkip({
            subjectType: 'player',
            view: 'combatantInfo',
            reportCode: reportPreview.code,
            fightId: fight.id,
            reason: combatantUnavailable,
          })
        }

        const subjectCombatantDetails =
          sourceId !== undefined ? extractCombatantDetails(combatantResult.events, sourceId) : null
        if (subjectCombatantDetails) {
          combatantItemLevel = subjectCombatantDetails.itemLevel
          subjectCombatantInfoItemLevel = coalesceKnownItemLevel(subjectCombatantInfoItemLevel, subjectCombatantDetails.itemLevel)
          combatantSpecName = subjectCombatantDetails.specName
          combatantRole = subjectCombatantDetails.role
        }

        if (request.views.includes('combatantInfo') && sourceId && subjectCombatantDetails) {
          combatantRows.push({
            subjectType: 'player',
            reportCode: reportPreview.code,
            fightId: fight.id,
            sourceName: playerActor?.name ?? playerName,
            sourceId: sourceId ?? '',
            className: preview.detectedPlayer?.className ?? 'unknown',
            specName: subjectCombatantDetails.specName ?? 'unknown',
            role: subjectCombatantDetails.role ?? 'unknown',
            itemLevel: subjectCombatantDetails.itemLevel ?? '',
            talentsJson: subjectCombatantDetails.talentsJson,
            gearJson: subjectCombatantDetails.gearJson,
            rawJson: subjectCombatantDetails.rawJson,
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
        const warning = `Player ${playerName} not present in fight ${fight.id} of ${reportPreview.code} — event views skipped.`
        addGroupedWarning('viewFetch', warning)
        markPartial(`Player absent or unresolved source ID for ${reportPreview.code}#${fight.id}; requested event views were skipped.`)
        for (const view of selectedViews) {
          if (view === 'fightMetadata' || view === 'combatantInfo') continue
          addViewSkip({
            subjectType: 'player',
            view,
            reportCode: reportPreview.code,
            fightId: fight.id,
            reason: 'player not present or source ID missing',
          })
        }
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

        for (const warning of result.warnings) {
          addGroupedWarning('viewFetch', warning)
        }
        if (result.truncated) {
          addViewTruncation({
            subjectType: 'player',
            view,
            reportCode: reportPreview.code,
            fightId: fight.id,
            rowLimit: limits.maxEventsPerFightPerView,
            context: `${playerName} ${VIEW_LABELS[view]}`,
          })
        }
        const availabilityWarning = result.warnings.find((warning) => warning.toLowerCase().includes('not available'))
        if (availabilityWarning) {
          addViewSkip({
            subjectType: 'player',
            view,
            reportCode: reportPreview.code,
            fightId: fight.id,
            reason: availabilityWarning,
          })
        }

        // Map events to CSV rows
        for (const event of result.events) {
          const enriched = enrichWclEvent(event, ctx.fightStartTime, actorMap, abilityMaps)
          const ctxFields = fightContextFields(ctx)

          if (view === 'deaths') {
            const deathTs = typeof event.timestamp === 'number' ? event.timestamp : 0
            playerRows[view].push({
              ...ctxFields,
              ...enriched,
              deathTimestampMs: deathTs,
              deathRelativeTimestampMs: Math.max(0, Math.floor(deathTs - ctx.fightStartTime)),
              killingBlowAbility: enriched.abilityName || enriched.abilityGameId || '',
              killingBlowSource: enriched.sourceName,
              lastDamageEventsJson: '[]',
              rawEventJson: enriched.rawEventJson,
              rawJson: enriched.rawEventJson,
            })
          } else {
            playerRows[view].push({ ...ctxFields, ...enriched })
          }
        }

        JobStore.advance(exportId)
      }
    }
  }

  // Benchmark
  const benchmarkValidation = validateExportBenchmarkRequest(request)
  const benchmarkRequested = benchmarkValidation.benchmarkRequested
  const benchmarkMode: 'auto' | 'manual' | 'none' = benchmarkValidation.benchmarkMode
  const allowSubjectOnlyWithoutBenchmark = benchmarkValidation.allowSubjectOnlyWithoutBenchmark
  const benchmarkRequestedButNotIncludedReason =
    benchmarkValidation.blockedReason && allowSubjectOnlyWithoutBenchmark
      ? benchmarkValidation.blockedReason
      : null

  let benchmarkIncluded = false
  const benchmarkWarnings: string[] = []
  const benchmarkItemLevelMismatches: Array<{
    benchmarkPlayerName: string
    benchmarkReportCode: string
    benchmarkFightId: number
    benchmarkCandidateItemLevel: number
    benchmarkCombatantInfoItemLevel: number
    delta: number
  }> = []
  let benchmarkCandidate: Record<string, unknown> | null = null
  const skippedCandidates: PlayerAnalysisBenchmarkSkippedCandidate[] = []
  const exportedCandidates: Array<Record<string, unknown>> = []
  const selectedCandidatesForManifest: Array<Record<string, unknown>> = []

  const subjectClassName = preview.effectiveContext?.className ?? preview.detectedPlayer?.className ?? 'unknown'
  const subjectSpecName = preview.effectiveContext?.specName ?? preview.detectedPlayer?.specName ?? 'unknown'

  const addBenchmarkWarning = (warning: string) => {
    benchmarkWarnings.push(warning)
    addGroupedWarning('benchmark', warning)
  }

  const pushSkippedCandidate = (candidate: SelectedBenchmarkCandidate, reason: string) => {
    skippedCandidates.push({
      reason,
      benchmarkPlayerName: candidate.benchmarkPlayerName,
      benchmarkReportCode: candidate.benchmarkReportCode,
      benchmarkFightId: candidate.benchmarkFightId,
      baselineReportCode: candidate.baselineReportCode,
      baselineFightId: candidate.baselineFightId,
    })
    markPartial(`Benchmark candidate skipped: ${reason}`)
    addGroupedWarning('candidateSkip', `Benchmark candidate skipped: ${reason}`)
    addBenchmarkWarning(`Benchmark skipped: ${reason}`)
  }

  const createLinkFields = (
    candidate: SelectedBenchmarkCandidate,
    overrides?: {
      benchmarkClassName?: string
      benchmarkSpecName?: string
      benchmarkCombatantInfoItemLevel?: number | null
    }
  ): Record<string, unknown> => ({
    baselineReportCode: candidate.baselineReportCode,
    baselineFightId: candidate.baselineFightId,
    baselineEncounterName: candidate.baselineEncounterName,
    baselineDifficulty: candidate.baselineDifficulty,
    subjectPlayerName: playerName,
    subjectClassName,
    subjectSpecName,
    benchmarkReportCode: candidate.benchmarkReportCode,
    benchmarkFightId: candidate.benchmarkFightId,
    benchmarkPlayerName: candidate.benchmarkPlayerName,
    benchmarkClassName: overrides?.benchmarkClassName ?? candidate.benchmarkClassName,
    benchmarkSpecName: overrides?.benchmarkSpecName ?? candidate.benchmarkSpecName,
    benchmarkPercentile: candidate.benchmarkPercentile ?? '',
    benchmarkCandidateItemLevel: candidate.benchmarkCandidateItemLevel ?? candidate.benchmarkItemLevel ?? '',
    benchmarkItemLevel: candidate.benchmarkCandidateItemLevel ?? candidate.benchmarkItemLevel ?? '',
    benchmarkCandidateItemLevelSource: 'wclRankings',
    benchmarkCombatantInfoItemLevel: overrides?.benchmarkCombatantInfoItemLevel ?? candidate.benchmarkCombatantInfoItemLevel ?? '',
    benchmarkDurationMs: candidate.benchmarkDurationMs ?? '',
  })

  const exportBenchmarkCandidate = async (candidate: SelectedBenchmarkCandidate): Promise<void> => {
    const benchmarkCandidateItemLevel = candidate.benchmarkCandidateItemLevel ?? candidate.benchmarkItemLevel ?? null
    const candidateForManifest: Record<string, unknown> = {
      ...candidate,
      benchmarkCandidateItemLevel,
      benchmarkCandidateItemLevelSource: 'wclRankings',
      benchmarkCombatantInfoItemLevel: candidate.benchmarkCombatantInfoItemLevel ?? null,
    }
    selectedCandidatesForManifest.push(candidateForManifest)
    const benchReportDetails = await WclService.getReportDetails(config, candidate.benchmarkReportCode).catch(() => null)
    if (!benchReportDetails) {
      pushSkippedCandidate(candidate, `could not load benchmark report ${candidate.benchmarkReportCode}`)
      for (const view of selectedViews) {
        addViewSkip({
          subjectType: 'benchmark',
          view,
          reportCode: candidate.benchmarkReportCode,
          fightId: candidate.benchmarkFightId,
          reason: 'benchmark report unavailable',
        })
      }
      return
    }

    const benchFight = benchReportDetails.fights.find((f) => f.id === candidate.benchmarkFightId)
    if (!benchFight) {
      pushSkippedCandidate(
        candidate,
        `fight ${candidate.benchmarkFightId} not found in benchmark report ${candidate.benchmarkReportCode}`
      )
      for (const view of selectedViews) {
        addViewSkip({
          subjectType: 'benchmark',
          view,
          reportCode: candidate.benchmarkReportCode,
          fightId: candidate.benchmarkFightId,
          reason: 'benchmark fight not found',
        })
      }
      return
    }

    const { actorMap: benchActorMap, abilityMaps: benchAbilityMaps } = await getActorAndAbilityMaps(config, candidate.benchmarkReportCode)
    const benchActorsResponse = await queryWclGraphQl<ReportPlayersQueryResponse>({
      config,
      query: REPORT_PLAYERS_QUERY,
      variables: { code: candidate.benchmarkReportCode },
    }).catch(() => null)
    const benchActors = benchActorsResponse?.reportData?.report?.masterData?.actors ?? []
    const benchActor = benchActors.find(
      (a) => a.type === 'Player' && a.name?.toLowerCase() === candidate.benchmarkPlayerName.toLowerCase()
    )
    if (!benchActor) {
      pushSkippedCandidate(
        candidate,
        `benchmark player "${candidate.benchmarkPlayerName}" not found in report masterData`
      )
      for (const view of selectedViews) {
        if (view === 'fightMetadata') continue
        addViewSkip({
          subjectType: 'benchmark',
          view,
          reportCode: candidate.benchmarkReportCode,
          fightId: candidate.benchmarkFightId,
          reason: 'benchmark player actor not found',
        })
      }
      return
    }

    const benchSourceId = benchActor.id
    let benchmarkCombatantInfoItemLevel: number | null = candidate.benchmarkCombatantInfoItemLevel ?? null
    let linkFields = createLinkFields(candidate, {
      benchmarkClassName: candidate.benchmarkClassName || benchActor.subType || 'unknown',
      benchmarkSpecName: candidate.benchmarkSpecName || 'unknown',
      benchmarkCombatantInfoItemLevel,
    })
    const benchDurationMs = Math.max(benchFight.endTime - benchFight.startTime, 0)
    const benchCtx: FightContext = {
      exportId,
      subjectType: 'benchmark',
      reportCode: candidate.benchmarkReportCode,
      reportTitle: benchReportDetails.title ?? candidate.benchmarkReportCode,
      fightId: candidate.benchmarkFightId,
      encounterId: benchFight.encounterId,
      encounterName: benchFight.encounterName,
      difficulty: benchFight.difficulty,
      kill: benchFight.kill,
      fightDurationMs: benchDurationMs,
      fightStartTime: benchFight.startTime,
    }

    if (request.views.includes('fightMetadata')) {
      benchmarkFightRows.push({
        ...linkFields,
        subjectType: 'benchmark',
        reportCode: candidate.benchmarkReportCode,
        reportTitle: benchReportDetails.title ?? candidate.benchmarkReportCode,
        fightId: candidate.benchmarkFightId,
        encounterId: benchFight.encounterId,
        encounterName: benchFight.encounterName,
        difficulty: benchFight.difficulty,
        kill: benchFight.kill,
        startTime: benchReportDetails.startTime + benchFight.startTime,
        endTime: benchReportDetails.startTime + benchFight.endTime,
        durationMs: benchDurationMs,
        playerPresent: true,
        sourceName: candidate.benchmarkPlayerName,
        sourceId: benchSourceId,
        className: candidate.benchmarkClassName,
        specName: candidate.benchmarkSpecName,
        role: 'unknown',
        itemLevel: benchmarkCandidateItemLevel ?? '',
        wclReportUrl: `https://www.warcraftlogs.com/reports/${candidate.benchmarkReportCode}#fight=${candidate.benchmarkFightId}`,
      })
    }

    if (request.views.includes('combatantInfo')) {
      JobStore.setStep(exportId, 'Fetching benchmark — Combatant info...', { view: 'combatantInfo' })
      const combatantResult = await fetchCombatantInfoEvents({
        config,
        code: candidate.benchmarkReportCode,
        fightId: candidate.benchmarkFightId,
        startTime: benchFight.startTime,
        endTime: benchFight.endTime,
        maxEvents: 50,
      })
      for (const warning of combatantResult.warnings) {
        addGroupedWarning('viewFetch', warning)
      }
      const combatantUnavailable = combatantResult.warnings.find((warning) =>
        warning.toLowerCase().includes('not available')
      )
      if (combatantUnavailable) {
        addViewSkip({
          subjectType: 'benchmark',
          view: 'combatantInfo',
          reportCode: candidate.benchmarkReportCode,
          fightId: candidate.benchmarkFightId,
          reason: combatantUnavailable,
        })
      }
      const details = extractCombatantDetails(combatantResult.events, benchSourceId)
      benchmarkCombatantInfoItemLevel = details.itemLevel
      candidateForManifest['benchmarkCombatantInfoItemLevel'] = details.itemLevel ?? null
      linkFields = createLinkFields(candidate, {
        benchmarkClassName: candidate.benchmarkClassName || benchActor.subType || 'unknown',
        benchmarkSpecName: candidate.benchmarkSpecName || 'unknown',
        benchmarkCombatantInfoItemLevel,
      })

      if (typeof benchmarkCandidateItemLevel === 'number' && typeof details.itemLevel === 'number') {
        const ilvlDelta = Math.abs(benchmarkCandidateItemLevel - details.itemLevel)
        if (ilvlDelta > 3) {
          const mismatchWarning = `Benchmark item level mismatch for ${candidate.benchmarkPlayerName} (${candidate.benchmarkReportCode}#${candidate.benchmarkFightId}): ranking=${benchmarkCandidateItemLevel}, combatantInfo=${details.itemLevel}, delta=${ilvlDelta}.`
          addBenchmarkWarning(mismatchWarning)
          benchmarkItemLevelMismatches.push({
            benchmarkPlayerName: candidate.benchmarkPlayerName,
            benchmarkReportCode: candidate.benchmarkReportCode,
            benchmarkFightId: candidate.benchmarkFightId,
            benchmarkCandidateItemLevel,
            benchmarkCombatantInfoItemLevel: details.itemLevel,
            delta: ilvlDelta,
          })
          candidateForManifest['benchmarkItemLevelMismatchWarning'] = mismatchWarning
        }
      }

      benchmarkCombatantRows.push({
        ...linkFields,
        subjectType: 'benchmark',
        reportCode: candidate.benchmarkReportCode,
        fightId: candidate.benchmarkFightId,
        sourceName: candidate.benchmarkPlayerName,
        sourceId: benchSourceId,
        className: candidate.benchmarkClassName || 'unknown',
        specName: details.specName ?? candidate.benchmarkSpecName ?? 'unknown',
        role: details.role ?? 'unknown',
        itemLevel: details.itemLevel ?? '',
        talentsJson: details.talentsJson,
        gearJson: details.gearJson,
        rawJson: details.rawJson,
      })
      JobStore.advance(exportId)
    }

    for (const view of request.views) {
      if (view === 'fightMetadata' || view === 'combatantInfo') continue

      JobStore.setStep(exportId, `Fetching benchmark — ${VIEW_LABELS[view]}...`, { view })

      const fetchParams = {
        config,
        code: candidate.benchmarkReportCode,
        fightId: candidate.benchmarkFightId,
        startTime: benchFight.startTime,
        endTime: benchFight.endTime,
        sourceId: benchSourceId,
        targetId: benchSourceId,
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
        result = { ...allDeaths, events: allDeaths.events.filter((e) => e.targetID === benchSourceId) }
      }
      else if (view === 'interrupts') result = await fetchInterruptEvents({ ...fetchParams, targetId: undefined })
      else if (view === 'dispels') result = await fetchDispelEvents({ ...fetchParams, targetId: undefined })
      else if (view === 'resources') result = await fetchResourceEvents({ ...fetchParams, targetId: undefined })

      for (const warning of result.warnings) {
        addGroupedWarning('viewFetch', warning)
      }
      if (result.truncated) {
        addViewTruncation({
          subjectType: 'benchmark',
          view,
          reportCode: candidate.benchmarkReportCode,
          fightId: candidate.benchmarkFightId,
          rowLimit: limits.maxEventsPerFightPerView,
          context: `${candidate.benchmarkPlayerName} ${VIEW_LABELS[view]}`,
        })
      }
      const availabilityWarning = result.warnings.find((warning) => warning.toLowerCase().includes('not available'))
      if (availabilityWarning) {
        addViewSkip({
          subjectType: 'benchmark',
          view,
          reportCode: candidate.benchmarkReportCode,
          fightId: candidate.benchmarkFightId,
          reason: availabilityWarning,
        })
      }

      for (const event of result.events) {
        const enriched = enrichWclEvent(event, benchCtx.fightStartTime, benchActorMap, benchAbilityMaps)
        const ctxFields = fightContextFields(benchCtx)
        if (view === 'deaths') {
          const deathTs = typeof event.timestamp === 'number' ? event.timestamp : 0
          benchmarkRows[view].push({
            ...linkFields,
            ...ctxFields,
            ...enriched,
            deathTimestampMs: deathTs,
            deathRelativeTimestampMs: Math.max(0, Math.floor(deathTs - benchCtx.fightStartTime)),
            killingBlowAbility: enriched.abilityName || enriched.abilityGameId || '',
            killingBlowSource: enriched.sourceName,
            lastDamageEventsJson: '[]',
            rawEventJson: enriched.rawEventJson,
            rawJson: enriched.rawEventJson,
          })
        } else {
          benchmarkRows[view].push({ ...linkFields, ...ctxFields, ...enriched })
        }
      }
      JobStore.advance(exportId)
    }

    exportedCandidates.push(candidateForManifest)
    benchmarkIncluded = true
  }

  if (benchmarkRequested) {
    if (benchmarkMode === 'manual') {
      const manualTarget = benchmarkValidation.manualTarget
      if (!manualTarget) {
        if (benchmarkRequestedButNotIncludedReason) {
          skippedCandidates.push({
            reason: benchmarkRequestedButNotIncludedReason,
          })
          for (const view of selectedViews) {
            addViewSkip({
              subjectType: 'benchmark',
              view,
              reason: benchmarkRequestedButNotIncludedReason,
            })
          }
          markPartial('Benchmark was requested but omitted because the manual target was incomplete.')
          addBenchmarkWarning(`Benchmark requested but not included: ${benchmarkRequestedButNotIncludedReason}`)
        }
      } else {
        const manualCandidate: SelectedBenchmarkCandidate = {
          baselineReportCode: manualTarget.reportCode,
          baselineFightId: manualTarget.fightId,
          baselineEncounterId: 0,
          baselineEncounterName: 'Manual benchmark',
          baselineDifficulty: 0,
          benchmarkPlayerName: manualTarget.playerName,
          benchmarkReportCode: manualTarget.reportCode,
          benchmarkFightId: manualTarget.fightId,
          benchmarkEncounterId: 0,
          benchmarkDifficulty: 0,
          benchmarkClassName: '',
          benchmarkSpecName: '',
        }
        benchmarkCandidate = manualCandidate as unknown as Record<string, unknown>
        await exportBenchmarkCandidate(manualCandidate)
      }
    } else if (benchmarkMode === 'auto') {
      const selectedCandidates = benchmarkValidation.exportableSelectedCandidates
      if (selectedCandidates.length === 0 && benchmarkRequestedButNotIncludedReason) {
        skippedCandidates.push({
          reason: benchmarkRequestedButNotIncludedReason,
        })
        for (const view of selectedViews) {
          addViewSkip({
            subjectType: 'benchmark',
            view,
            reason: benchmarkRequestedButNotIncludedReason,
          })
        }
        markPartial('Benchmark was requested but omitted because no exportable candidates were selected.')
        addBenchmarkWarning(`Benchmark requested but not included: ${benchmarkRequestedButNotIncludedReason}`)
      }
      for (const candidate of selectedCandidates) {
        await exportBenchmarkCandidate(candidate)
      }
    }

    if (!benchmarkIncluded && !allowSubjectOnlyWithoutBenchmark) {
      markPartial('Benchmark comparison was requested but no benchmark candidate could be exported.')
      addError('Benchmark comparison was requested but no benchmark candidate could be exported.', {
        group: 'benchmark',
      })
    }
    if (benchmarkRequestedButNotIncludedReason) {
      markPartial(`Benchmark omitted: ${benchmarkRequestedButNotIncludedReason}`)
    }
  }

  // Data quality
  const dataQualityStats: DataQualityStats[] = []
  for (const view of request.views) {
    if (view === 'fightMetadata' || view === 'combatantInfo') continue
    dataQualityStats.push(computeDataQuality(view, playerRows[view]))
  }
  for (const dq of dataQualityStats) {
    if (dq.abilityNamePct < 50 && dq.totalRows > 0) {
      addGroupedWarning(
        'dataQuality',
        `Low abilityName coverage in ${dq.view}: ${dq.abilityNamePct}% (${dq.lowAbilityNameReason ?? 'limited ability mapping coverage'}).`
      )
    }
  }

  // Write CSV files
  JobStore.setStep(exportId, 'Writing CSV files...')

  const writtenFiles: PlayerAnalysisExportFile[] = []
  const exportedBenchmarkFiles: string[] = []

  // fights.csv
  if (request.views.includes('fightMetadata')) {
    const content = buildCsvFile(FIGHTS_CSV_HEADERS, fightRows)
    const { sizeBytes } = writeExportFile(exportId, 'player-fights.csv', content)
    exportedViews.add('fightMetadata')
    writtenFiles.push({ filename: 'player-fights.csv', kind: 'csv', view: 'fightMetadata', sizeBytes, rowCount: fightRows.length, downloadUrl: `/api/player-analysis/exports/${exportId}/player-fights.csv` })
    if (benchmarkIncluded) {
      const benchContent = buildCsvFile(FIGHTS_CSV_HEADERS, benchmarkFightRows)
      const { sizeBytes: benchSize } = writeExportFile(exportId, 'benchmark-fights.csv', benchContent)
      writtenFiles.push({
        filename: 'benchmark-fights.csv',
        kind: 'benchmarkCsv',
        view: 'fightMetadata',
        sizeBytes: benchSize,
        rowCount: benchmarkFightRows.length,
        downloadUrl: `/api/player-analysis/exports/${exportId}/benchmark-fights.csv`,
      })
      exportedBenchmarkFiles.push('benchmark-fights.csv')
    }
  }

  // combatant-info.csv
  if (request.views.includes('combatantInfo')) {
    const content = buildCsvFile(COMBATANT_INFO_CSV_HEADERS, combatantRows)
    const { sizeBytes } = writeExportFile(exportId, 'player-combatant-info.csv', content)
    exportedViews.add('combatantInfo')
    writtenFiles.push({ filename: 'player-combatant-info.csv', kind: 'csv', view: 'combatantInfo', sizeBytes, rowCount: combatantRows.length, downloadUrl: `/api/player-analysis/exports/${exportId}/player-combatant-info.csv` })
    if (benchmarkIncluded) {
      const benchContent = buildCsvFile(COMBATANT_INFO_CSV_HEADERS, benchmarkCombatantRows)
      const { sizeBytes: benchSize } = writeExportFile(exportId, 'benchmark-combatant-info.csv', benchContent)
      writtenFiles.push({
        filename: 'benchmark-combatant-info.csv',
        kind: 'benchmarkCsv',
        view: 'combatantInfo',
        sizeBytes: benchSize,
        rowCount: benchmarkCombatantRows.length,
        downloadUrl: `/api/player-analysis/exports/${exportId}/benchmark-combatant-info.csv`,
      })
      exportedBenchmarkFiles.push('benchmark-combatant-info.csv')
    }
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
    exportedViews.add(view)
    writtenFiles.push({ filename, kind: 'csv', view, sizeBytes, rowCount: rows.length, downloadUrl: `/api/player-analysis/exports/${exportId}/${filename}` })

    if (benchmarkIncluded) {
      const benchRows = benchmarkRows[view]
      const benchFilename = csvFilename(view, 'benchmark')
      const benchContent = buildCsvFile(headers, benchRows)
      const { sizeBytes: benchSize } = writeExportFile(exportId, benchFilename, benchContent)
      writtenFiles.push({ filename: benchFilename, kind: 'benchmarkCsv', view, sizeBytes: benchSize, rowCount: benchRows.length, downloadUrl: `/api/player-analysis/exports/${exportId}/${benchFilename}` })
      exportedBenchmarkFiles.push(benchFilename)
    }
  }

  // comparison-summary.csv + benchmark metadata file
  if (benchmarkRequested && benchmarkMode === 'auto') {
    writeExportJsonFile(exportId, 'benchmark-candidates.json', {
      mode: 'auto',
      requested: true,
      included: benchmarkIncluded,
      allowSubjectOnlyWithoutBenchmark,
      reason: benchmarkIncluded ? null : (benchmarkRequestedButNotIncludedReason ?? null),
      targetPercentile: request.benchmark?.targetPercentile ?? null,
      metric: request.benchmark?.metric ?? null,
      subjectCombatantInfoItemLevel,
      selectedCandidates: selectedCandidatesForManifest,
      exportedCandidates,
      skippedCandidates,
      benchmarkItemLevelMismatches,
      warnings: benchmarkWarnings,
    })
    writtenFiles.push({ filename: 'benchmark-candidates.json', kind: 'benchmarkJson', sizeBytes: getExportFileSize(exportId, 'benchmark-candidates.json'), downloadUrl: `/api/player-analysis/exports/${exportId}/benchmark-candidates.json` })
    exportedBenchmarkFiles.push('benchmark-candidates.json')
  } else if (benchmarkRequested && benchmarkMode === 'manual') {
    writeExportJsonFile(exportId, 'benchmark-candidate.json', {
      mode: 'manual',
      requested: true,
      included: benchmarkIncluded,
      allowSubjectOnlyWithoutBenchmark,
      reason: benchmarkIncluded ? null : (benchmarkRequestedButNotIncludedReason ?? null),
      candidate: benchmarkCandidate,
      subjectCombatantInfoItemLevel,
      exportedCandidates,
      skippedCandidates,
      benchmarkItemLevelMismatches,
      warnings: benchmarkWarnings,
    })
    writtenFiles.push({ filename: 'benchmark-candidate.json', kind: 'benchmarkJson', sizeBytes: getExportFileSize(exportId, 'benchmark-candidate.json'), downloadUrl: `/api/player-analysis/exports/${exportId}/benchmark-candidate.json` })
    exportedBenchmarkFiles.push('benchmark-candidate.json')
  }

  if (benchmarkIncluded) {
    const comparisonRows = buildComparisonSummary(playerRows, benchmarkRows, request.views)
    const compContent = buildCsvFile(COMPARISON_SUMMARY_CSV_HEADERS, comparisonRows)
    const { sizeBytes: compSize } = writeExportFile(exportId, 'comparison-summary.csv', compContent)
    writtenFiles.push({ filename: 'comparison-summary.csv', kind: 'csv', sizeBytes: compSize, rowCount: comparisonRows.length, downloadUrl: `/api/player-analysis/exports/${exportId}/comparison-summary.csv` })
    exportedBenchmarkFiles.push('comparison-summary.csv')
  }

  // Write manifest + README
  JobStore.setStep(exportId, 'Writing manifest and README...')

  const benchmarkSummary: PlayerAnalysisBenchmarkSummary = {
    requested: benchmarkRequested,
    included: benchmarkIncluded,
    mode: benchmarkMode,
    selectedCount:
      benchmarkMode === 'manual'
        ? (benchmarkValidation.manualTarget ? 1 : 0)
        : benchmarkMode === 'auto'
          ? benchmarkValidation.exportableSelectedCandidates.length
          : 0,
    exportedCount: exportedCandidates.length,
    skippedCount: skippedCandidates.length,
    skippedCandidates,
    omittedReason:
      benchmarkRequested && !benchmarkIncluded
        ? (benchmarkRequestedButNotIncludedReason ?? 'No benchmark candidates were exported.')
        : null,
  }
  const viewSummary: PlayerAnalysisViewSummary = {
    selectedViews,
    exportedViews: Array.from(exportedViews),
    skippedViews,
    truncatedViews,
  }

  const manifest = {
    exportId,
    createdAt: new Date().toISOString(),
    playerName,
    subjectCombatantInfoItemLevel,
    views: request.views,
    scope: preview.scope,
    detectedContext: preview.detectedPlayer?.detectedContext ?? null,
    userContext: request.playerContext ?? null,
    effectiveContext: preview.effectiveContext ?? null,
    contextWarnings: preview.contextWarnings ?? [],
    benchmarkContextSource: request.benchmarkContextSource ?? null,
    benchmarkRequested,
    benchmarkIncluded,
    benchmarkMode,
    allowSubjectOnlyWithoutBenchmark,
    selectedCandidates: selectedCandidatesForManifest,
    exportedBenchmarkFiles,
    skippedCandidates,
    benchmarkWarnings,
    benchmarkItemLevelMismatches,
    benchmarkReason: benchmarkIncluded ? null : benchmarkRequestedButNotIncludedReason,
    benchmarkSummary,
    viewSummary,
    warningGroups,
    errors,
    dataQuality: dataQualityStats,
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
    subjectCombatantInfoItemLevel,
    scope: preview.scope,
    views: request.views,
    benchmarkEnabled: benchmarkIncluded,
    benchmarkMode,
    benchmarkWarnings,
    benchmarkRequested,
    benchmarkIncluded,
    benchmarkRequestedButNotIncludedReason,
    allowSubjectOnlyWithoutBenchmark,
    selectedBenchmarkCandidates: selectedCandidatesForManifest,
    exportedBenchmarkCandidates: exportedCandidates,
    skippedBenchmarkCandidates: skippedCandidates,
    warnings: allWarnings,
    detectedContext: preview.detectedPlayer?.detectedContext,
    userContext: request.playerContext,
    effectiveContext: preview.effectiveContext,
    contextWarnings: preview.contextWarnings,
    dataQuality: dataQualityStats,
    warningGroups,
    errors,
    benchmarkSummary,
    viewSummary,
    benchmarkItemLevelMismatches,
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

  const hasZip = writtenFiles.some((file) => file.kind === 'zip')
  const hasSubjectCsv = writtenFiles.some(
    (file) => file.kind === 'csv' && (!file.filename.startsWith('benchmark-'))
  )
  const hasUsableSubjectBundle = hasZip && hasSubjectCsv
  const hasPartialOutcome =
    partialReasons.size > 0 ||
    skippedViews.length > 0 ||
    truncatedViews.length > 0 ||
    (benchmarkRequested && !benchmarkIncluded)

  if (!hasUsableSubjectBundle) {
    const failureMessage = 'Export failed before a usable subject bundle could be produced.'
    addError(failureMessage, { asWarning: false })
    JobStore.fail(exportId, failureMessage, {
      files: writtenFiles,
      warnings: allWarnings,
      errors,
      warningGroups,
      benchmarkSummary,
      viewSummary,
      currentStep: 'Export failed.',
    })
    return
  }

  if (hasPartialOutcome) {
    JobStore.partial(exportId, writtenFiles, {
      warnings: allWarnings,
      errors,
      warningGroups,
      benchmarkSummary,
      viewSummary,
      currentStep: 'Export completed with partial data.',
    })
    return
  }

  JobStore.complete(exportId, writtenFiles, {
    warnings: allWarnings,
    errors,
    warningGroups,
    benchmarkSummary,
    viewSummary,
    currentStep: 'Export complete.',
  })
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
  const comparableViews = views.filter((view) => view !== 'fightMetadata' && view !== 'combatantInfo')

  const sumAmount = (records: Record<string, unknown>[]): number | null => {
    const hasNumericAmount = records.some((row) => Number.isFinite(Number(row['amount'])))
    if (!hasNumericAmount) return null
    return records.reduce((total, row) => total + (Number(row['amount']) || 0), 0)
  }

  for (const view of comparableViews) {
    const benchByGroup = new Map<string, Record<string, unknown>[]>()
    for (const row of benchmarkRows[view] ?? []) {
      const key = [
        String(row['baselineReportCode'] ?? ''),
        String(row['baselineFightId'] ?? ''),
        String(row['benchmarkReportCode'] ?? ''),
        String(row['benchmarkFightId'] ?? ''),
      ].join('|')
      const current = benchByGroup.get(key)
      if (current) current.push(row)
      else benchByGroup.set(key, [row])
    }

    for (const groupRows of benchByGroup.values()) {
      const sample = groupRows[0]
      const baselineReportCode = String(sample['baselineReportCode'] ?? '')
      const baselineFightId = Number(sample['baselineFightId'] ?? 0)
      const subjectRowsForBaseline = (playerRows[view] ?? []).filter(
        (row) =>
          String(row['reportCode'] ?? '') === baselineReportCode &&
          Number(row['fightId'] ?? 0) === baselineFightId
      )

      const subjectTotalAmount = sumAmount(subjectRowsForBaseline)
      const benchmarkTotalAmount = sumAmount(groupRows)
      const delta =
        subjectTotalAmount !== null && benchmarkTotalAmount !== null
          ? subjectTotalAmount - benchmarkTotalAmount
          : null
      const deltaPercent =
        delta !== null && benchmarkTotalAmount !== null && benchmarkTotalAmount !== 0
          ? Number(((delta / benchmarkTotalAmount) * 100).toFixed(2))
          : null

      let warning = ''
      if (subjectRowsForBaseline.length === 0) {
        warning = `No subject rows found for baseline ${baselineReportCode}#${baselineFightId}.`
      } else if (subjectTotalAmount === null || benchmarkTotalAmount === null) {
        warning = 'Amount aggregation not available for this view; row counts shown.'
      }

      rows.push({
        baselineReportCode,
        baselineFightId,
        encounterName: sample['baselineEncounterName'] ?? sample['encounterName'] ?? '',
        difficulty: sample['baselineDifficulty'] ?? sample['difficulty'] ?? '',
        subjectPlayerName: sample['subjectPlayerName'] ?? '',
        subjectClassName: sample['subjectClassName'] ?? '',
        subjectSpecName: sample['subjectSpecName'] ?? '',
        benchmarkPlayerName: sample['benchmarkPlayerName'] ?? '',
        benchmarkReportCode: sample['benchmarkReportCode'] ?? '',
        benchmarkFightId: sample['benchmarkFightId'] ?? '',
        benchmarkPercentile: sample['benchmarkPercentile'] ?? '',
        view,
        metric: subjectTotalAmount !== null && benchmarkTotalAmount !== null ? 'amount' : 'rows',
        subjectRows: subjectRowsForBaseline.length,
        benchmarkRows: groupRows.length,
        subjectTotalAmount: subjectTotalAmount ?? '',
        benchmarkTotalAmount: benchmarkTotalAmount ?? '',
        delta: delta ?? '',
        deltaPercent: deltaPercent ?? '',
        warning,
      })
    }
  }

  return rows
}
