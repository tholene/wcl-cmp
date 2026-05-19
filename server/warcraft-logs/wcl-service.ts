import type { WclConfig } from './wcl-config'
import { queryWclGraphQl } from './wcl-client'
import { isRaidZone } from './raid-zone-classifier'
import type {
  WclBossFightListItem,
  WclBossSummary,
  WclFightDamageEvent,
  WclFightDeathSummary,
  WclFightParticipant,
  WclPlayerFightReview,
  WclPlayerReviewEvent,
  WclPlayerReviewFinding,
  WclFightReview,
  WclFightSummary,
  WclRecentBossFightsResponse,
  WclRecentBossesResponse,
  WclRecentPlayer,
  WclPlayerFightSnapshot,
  WclPlayerReviewRoleMetadata,
  WclPlayerReviewScopePreview,
  WclPlayerReviewScopePreviewRequest,
  WclPlayerReviewSnapshot,
  WclPlayerReviewSnapshotRequest,
  WclReportDetails,
  WclReportSummary,
} from './wcl-types'

type ReportsQueryResponse = {
  reportData?: {
    reports?: {
      data?: Array<{
        code: string
        title: string
        startTime: number
        endTime: number
        visibility?: string | null
        owner?: {
          name?: string | null
        } | null
        zone?: {
          id?: number | null
          name?: string | null
        } | null
      }>
    }
  }
}

type ReportDetailsQueryResponse = {
  reportData?: {
    report?: {
      code: string
      title: string
      startTime: number
      endTime: number
      visibility?: string | null
      owner?: {
        name?: string | null
      } | null
      zone?: {
        id?: number | null
        name?: string | null
      } | null
      fights?: Array<{
        id: number
        encounterID: number
        name?: string | null
        kill: boolean
        difficulty: number
        startTime: number
        endTime: number
      }>
    } | null
  }
}

type WclActor = {
  id: number
  name?: string | null
  type?: string | null
  subType?: string | null
  icon?: string | null
}

type WclAbility = {
  gameID?: number | null
  name?: string | null
}

type WclRawEvent = {
  timestamp?: number | null
  sourceID?: number | null
  targetID?: number | null
  amount?: number | null
  absorbed?: number | null
  overkill?: number | null
  ability?: WclAbility | null
}

type WclEventsResponse = {
  data?: WclRawEvent[]
  nextPageTimestamp?: number | null
}

type FightReviewQueryResponse = {
  reportData?: {
    report?: {
      code: string
      title: string
      startTime: number
      fights?: Array<{
        id: number
        encounterID: number
        name?: string | null
        kill: boolean
        difficulty: number
        startTime: number
        endTime: number
      }>
      masterData?: {
        actors?: WclActor[]
      } | null
      deaths?: WclEventsResponse | null
      damageTaken?: WclEventsResponse | null
    } | null
  }
}

type PlayerReviewQueryResponse = {
  reportData?: {
    report?: {
      code: string
      title: string
      startTime: number
      fights?: Array<{
        id: number
        encounterID: number
        name?: string | null
        kill: boolean
        difficulty: number
        startTime: number
        endTime: number
      }>
      masterData?: {
        actors?: WclActor[]
      } | null
      casts?: WclEventsResponse | null
      damageDone?: WclEventsResponse | null
      damageTaken?: WclEventsResponse | null
      deaths?: WclEventsResponse | null
      buffs?: WclEventsResponse | null
      interrupts?: WclEventsResponse | null
      dispels?: WclEventsResponse | null
    } | null
  }
}

type ReportPlayersQueryResponse = {
  reportData?: {
    report?: {
      code: string
      startTime: number
      masterData?: {
        actors?: WclActor[]
      } | null
    } | null
  }
}

type WclKnownServiceErrorCode = 'NOT_FOUND' | 'BAD_REQUEST' | 'UPSTREAM'

type WclServiceError = Error & {
  code: WclKnownServiceErrorCode
}

const createWclServiceError = (message: string, code: WclKnownServiceErrorCode): WclServiceError => {
  const error = new Error(message) as WclServiceError
  error.name = 'WclServiceError'
  error.code = code
  return error
}
type AggregatedFightContext = {
  reportCode: string
  reportTitle: string
  reportStartTime: number
  reportUrl: string
  fightId: number
  encounterId: number
  encounterName: string
  kill: boolean
  difficulty: number
  startTime: number
  endTime: number
  durationMs: number
}

type AggregatedBossSource = {
  reportCount: number
  note: string
}

const RECENT_REPORT_LIMIT = 15

const REPORTS_BY_GUILD_QUERY = `
  query ReportsByGuild($guildId: Int!, $limit: Int!) {
    reportData {
      reports(guildID: $guildId, limit: $limit) {
        data {
          code
          title
          startTime
          endTime
          visibility
          owner {
            name
          }
          zone {
            id
            name
          }
        }
      }
    }
  }
`

const REPORT_DETAILS_QUERY = `
  query ReportDetails($code: String!) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        endTime
        visibility
        owner {
          name
        }
        zone {
          id
          name
        }
        fights {
          id
          encounterID
          name
          kill
          difficulty
          startTime
          endTime
        }
      }
    }
  }
`

const FIGHT_REVIEW_QUERY = `
  query FightReview(
    $code: String!
    $fightId: Int!
    $startTime: Float!
    $endTime: Float!
  ) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        fights(fightIDs: [$fightId]) {
          id
          encounterID
          name
          kill
          difficulty
          startTime
          endTime
        }
        masterData(translate: true) {
          actors {
            id
            name
            type
            subType
            icon
          }
        }
        deaths: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: Deaths
        ) {
          data
          nextPageTimestamp
        }
        damageTaken: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: DamageTaken
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`

const PLAYER_REVIEW_QUERY = `
  query PlayerFightReview(
    $code: String!
    $fightId: Int!
    $startTime: Float!
    $endTime: Float!
  ) {
    reportData {
      report(code: $code) {
        code
        title
        startTime
        fights(fightIDs: [$fightId]) {
          id
          encounterID
          name
          kill
          difficulty
          startTime
          endTime
        }
        masterData(translate: true) {
          actors {
            id
            name
            type
            subType
            icon
          }
        }
        casts: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: Casts
        ) {
          data
          nextPageTimestamp
        }
        damageDone: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: DamageDone
        ) {
          data
          nextPageTimestamp
        }
        damageTaken: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: DamageTaken
        ) {
          data
          nextPageTimestamp
        }
        deaths: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: Deaths
        ) {
          data
          nextPageTimestamp
        }
        buffs: events(
          startTime: $startTime
          endTime: $endTime
          fightIDs: [$fightId]
          dataType: Buffs
        ) {
          data
          nextPageTimestamp
        }
      }
    }
  }
`

const REPORT_PLAYERS_QUERY = `
  query ReportPlayers($code: String!) {
    reportData {
      report(code: $code) {
        code
        startTime
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

const mapFights = (
  fights: Array<{
    id: number
    encounterID: number
    name?: string | null
    kill: boolean
    difficulty?: number | null
    startTime: number
    endTime: number
  }> = []
): WclFightSummary[] =>
  fights
    .filter((fight) => fight.encounterID > 0)
    .map((fight) => ({
      id: fight.id,
      encounterId: fight.encounterID,
      encounterName: fight.name ?? `Unknown encounter ${fight.encounterID}`,
      kill: fight.kill,
      difficulty: fight.difficulty ?? 0,
      startTime: fight.startTime,
      endTime: fight.endTime,
    }))

const buildAggregationNote = (params: { reportCount: number; failedReportCount: number }): string => {
  if (!params.reportCount) {
    return 'No recent reports were available for aggregation.'
  }

  if (!params.failedReportCount) {
    return `Grouped from the latest ${params.reportCount} reports.`
  }

  return `Grouped from ${params.reportCount - params.failedReportCount}/${params.reportCount} reports. ${params.failedReportCount} report fetches failed and were skipped.`
}

const DAMAGE_WINDOW_MS = 10_000
const OPENER_WINDOW_MS = 45_000
const LONG_NO_CAST_GAP_MS = 10_000

const CONSUMABLE_ABILITY_NAMES = ['potion', 'healthstone']
const DEFENSIVE_ABILITY_NAMES = [
  'barkskin',
  'shield wall',
  'ice block',
  'survival instincts',
  'astral shift',
  'blur',
  'fortifying brew',
  'divine protection',
]
const INTERRUPT_ABILITY_NAMES = ['interrupt', 'counterspell', 'rebuke', 'kick', 'pummel', 'spell lock', 'wind shear']
const DISPEL_ABILITY_NAMES = ['dispel', 'purify', 'cleanse', 'remove corruption']

const toPositiveNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null
  }

  return value
}

const toAbilityName = (event: WclRawEvent): string => event.ability?.name ?? 'Unknown ability'

const includesKnownToken = (abilityName: string, tokens: string[]): boolean => {
  const normalized = abilityName.toLowerCase()
  return tokens.some((token) => normalized.includes(token))
}

const mapDamageEvent = (event: WclRawEvent, fightStartTime: number, sourceName?: string | null): WclFightDamageEvent => {
  const eventTimestamp = toPositiveNumber(event.timestamp) ?? fightStartTime

  return {
    timestampRelativeMs: Math.max(Math.floor(eventTimestamp - fightStartTime), 0),
    abilityId: event.ability?.gameID ?? null,
    abilityName: toAbilityName(event),
    sourceName: sourceName ?? null,
    amount: toPositiveNumber(event.amount),
  }
}

const mapPlayerReviewEvent = (params: {
  event: WclRawEvent
  fightStartTime: number
  eventType: string
  actorById: Map<number, WclActor>
}): WclPlayerReviewEvent => {
  const eventTimestamp = toPositiveNumber(params.event.timestamp) ?? params.fightStartTime
  const sourceName = params.actorById.get(params.event.sourceID ?? -1)?.name ?? null
  const targetName = params.actorById.get(params.event.targetID ?? -1)?.name ?? null

  return {
    timestampRelativeMs: Math.max(Math.floor(eventTimestamp - params.fightStartTime), 0),
    eventType: params.eventType,
    abilityId: params.event.ability?.gameID ?? null,
    abilityName: toAbilityName(params.event),
    sourceName,
    targetName,
    amount: toPositiveNumber(params.event.amount),
  }
}

const sortEventsByTimestamp = (events: WclRawEvent[]): WclRawEvent[] =>
  [...events]
    .filter((event) => typeof event.timestamp === 'number')
    .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0))

const mapParticipants = (actors: WclActor[] = []): WclFightParticipant[] =>
  actors
    .filter((actor) => actor.id > 0)
    .map((actor) => ({
      id: actor.id,
      name: actor.name ?? `Unknown actor ${actor.id}`,
      type: actor.type ?? null,
      className: actor.subType ?? null,
      icon: actor.icon ?? null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name))

const buildSourceNote = (params: { participantPartial: boolean; deathsPartial: boolean }): string => {
  const notes: string[] = []

  if (params.participantPartial) {
    notes.push('Participant data may be incomplete from source events.')
  }

  if (params.deathsPartial) {
    notes.push('Death timeline and pre-death damage evidence may be partial.')
  }

  if (!notes.length) {
    return 'Fight review includes report metadata, participants, and death evidence from available source events.'
  }

  return notes.join(' ')
}

const isNotFoundMessage = (value: string): boolean =>
  value.toLowerCase().includes('no report found') || value.toLowerCase().includes('not found')

const toActorMap = (actors: WclActor[] = []): Map<number, WclActor> => {
  const actorMap = new Map<number, WclActor>()

  actors.forEach((actor) => {
    if (actor.id > 0) {
      actorMap.set(actor.id, actor)
    }
  })

  return actorMap
}

const PLAYER_REVIEW_DEFAULT_LIMITS = {
  maxReports: 5,
  maxFights: 30,
  maxDeathsPerFight: 3,
  maxEventsBeforeDeath: 12,
  maxDamageTakenAbilities: 10,
  maxCasts: 25,
  maxBuffs: 25,
} as const

const PLAYER_REVIEW_HARD_LIMITS = {
  maxReports: 10,
  maxFights: 60,
  maxDeathsPerFight: 5,
  maxEventsBeforeDeath: 20,
  maxDamageTakenAbilities: 20,
  maxCasts: 50,
  maxBuffs: 50,
} as const

const UNKNOWN_ROLE_WARNING =
  'Role/spec was not available from the current data and should not be assumed.'

const buildUnknownRoleMetadata = (): WclPlayerReviewRoleMetadata => ({
  role: 'unknown',
  source: 'unknown',
  confidence: 'unknown',
  warnings: [UNKNOWN_ROLE_WARNING],
})

const buildPlayerReviewPrompt = (snapshot: WclPlayerReviewSnapshot): string => {
  const serializedSnapshot = JSON.stringify(snapshot, null, 2)
  const scope = snapshot.scopeSummary
  const scopeLabel = snapshot.scopeSummary.scopePreset ?? 'last-7-days'
  const roleLine =
    snapshot.roleMetadata.role === 'unknown'
      ? 'Role/spec is unknown, so provide generic player improvement analysis rather than role-specific judgement.'
      : `Role/spec in supplied data: ${snapshot.roleMetadata.role}${snapshot.roleMetadata.specName ? ` (${snapshot.roleMetadata.specName})` : ''}.`

  return `You are reviewing Warcraft Logs data for a World of Warcraft raider.

Your job is to produce fair, evidence-based coaching feedback. Be direct but constructive. Do not insult the player. Do not overstate conclusions where the data is incomplete.

Player under review:
${snapshot.player.name}

Data scope:
- Date range preset: ${scopeLabel}
- Reports scanned: ${scope.reportsScanned}
- Reports included: ${scope.reportsIncluded}
- Fights scanned: ${scope.fightsScanned}
- Fights included: ${scope.fightsIncluded}
- Only fights where the player was present: ${scope.onlyPlayerPresent ? 'yes' : 'no'}
- Payload limits applied: ${scope.payloadLimitsApplied.length ? scope.payloadLimitsApplied.join('; ') : 'none'}
- Warnings: ${[...snapshot.warnings, ...scope.warnings, ...snapshot.roleMetadata.warnings].join('; ') || 'none'}

Important analysis rules:
- Be direct but constructive.
- Do not insult, shame, or dunk on the player.
- Separate facts from interpretation.
- Do not overstate conclusions where data is incomplete.
- Do not assume the player's role or spec. If role/spec is unknown, say it is unknown and avoid role-specific claims.
- Do not describe the player as a tank, healer, or DPS unless the supplied data explicitly supports it.
- Treat wipe deaths carefully. A death during an already-failed pull may not be an individual mistake.
- Focus on repeated patterns over one-off mistakes.
- Identify where this player can most improve based on the evidence. This may include defensive usage, avoidable damage, rotation/cooldown usage, uptime, utility, mechanics, or other patterns.
- Please provide an infographic with core findings.

${roleLine}

Create the infographic as a compact text/Markdown infographic suitable for Discord or officer review. It should summarize the most important findings at a glance, such as deaths, avoidable damage patterns, defensive usage, cooldown/rotation concerns, and top 2-3 action items. Use concise labels, icons/emojis if helpful, and avoid long paragraphs.

Data:
${serializedSnapshot}

Please produce:

1. Executive summary
   - 3 to 5 bullet points on the player's main patterns.

2. Strengths
   - Mention anything the player appears to be doing well.

3. Biggest improvement areas
   - Prioritize the highest-impact issues.
   - Cite the specific fights, deaths, abilities, or repeated events from the data.

4. Death review
   - Summarize each death pattern.
   - Identify likely avoidable deaths.
   - Identify deaths that may be caused by raid-wide wipe conditions or lack of external support.

5. Defensive / survival usage
   - Did the player use personals, healthstone, potions, or relevant defensive tools?
   - Were they used before danger, late, or not at all?

6. Role-specific comments
   - If DPS: uptime, damage consistency, target/mechanic damage, avoidable damage taken.
   - If healer: deaths during healing pressure, dispels, cooldown usage, avoidable damage.
   - If tank: mitigation, taunt/swap issues, defensive coverage, spike damage.

7. Suggested feedback message to the player
   - Write this in a constructive Discord-friendly tone.
   - Keep it concise.
   - Include 2 to 3 specific things to work on next raid.

8. Officer-only notes
   - Anything the officer team should investigate manually in Warcraft Logs before speaking to the player.`
}

const mapFightDeaths = (params: {
  deaths: WclRawEvent[]
  damageTaken: WclRawEvent[]
  actorById: Map<number, WclActor>
  fightStartTime: number
  reportStartTime: number
}): WclFightDeathSummary[] => {
  const sortedDeaths = [...params.deaths]
    .filter((event) => typeof event.targetID === 'number' && typeof event.timestamp === 'number')
    .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0))

  const sortedDamageTaken = [...params.damageTaken]
    .filter((event) => typeof event.targetID === 'number' && typeof event.timestamp === 'number')
    .sort((left, right) => (left.timestamp ?? 0) - (right.timestamp ?? 0))

  return sortedDeaths.map((deathEvent) => {
    const deathTimestamp = deathEvent.timestamp ?? params.fightStartTime
    const playerId = deathEvent.targetID ?? -1
    const playerActor = params.actorById.get(playerId)

    const playerDamageWindow = sortedDamageTaken.filter((damageEvent) => {
      if (damageEvent.targetID !== playerId) {
        return false
      }

      const eventTimestamp = damageEvent.timestamp ?? 0
      return eventTimestamp >= deathTimestamp - DAMAGE_WINDOW_MS && eventTimestamp <= deathTimestamp
    })

    const recentDamageEvents = playerDamageWindow.map((damageEvent) =>
      mapDamageEvent(
        damageEvent,
        params.fightStartTime,
        params.actorById.get(damageEvent.sourceID ?? -1)?.name ?? null
      )
    )

    const finalDamageSource = params.actorById.get(deathEvent.sourceID ?? -1)
    const finalDamageEvent = mapDamageEvent(deathEvent, params.fightStartTime, finalDamageSource?.name ?? null)

    return {
      playerId,
      playerName: playerActor?.name ?? `Unknown actor ${playerId}`,
      className: playerActor?.subType ?? null,
      deathTime: params.reportStartTime + deathTimestamp,
      deathTimestampRelativeMs: Math.max(Math.floor(deathTimestamp - params.fightStartTime), 0),
      finalDamageEvent,
      recentDamageEvents,
    }
  })
}

const filterEventsByPlayer = (params: {
  events: WclRawEvent[]
  playerId: number
  mode: 'source' | 'target' | 'either'
}): WclRawEvent[] => {
  if (params.mode === 'source') {
    return params.events.filter((event) => event.sourceID === params.playerId)
  }

  if (params.mode === 'target') {
    return params.events.filter((event) => event.targetID === params.playerId)
  }

  return params.events.filter((event) => event.sourceID === params.playerId || event.targetID === params.playerId)
}

const mapPlayerEvents = (params: {
  events: WclRawEvent[]
  fightStartTime: number
  eventType: string
  actorById: Map<number, WclActor>
}): WclPlayerReviewEvent[] =>
  sortEventsByTimestamp(params.events).map((event) =>
    mapPlayerReviewEvent({
      event,
      fightStartTime: params.fightStartTime,
      eventType: params.eventType,
      actorById: params.actorById,
    })
  )

const calculateLongNoCastGaps = (casts: WclPlayerReviewEvent[]): number[] => {
  if (casts.length < 2) {
    return []
  }

  const gaps: number[] = []

  for (let index = 1; index < casts.length; index += 1) {
    const gap = casts[index].timestampRelativeMs - casts[index - 1].timestampRelativeMs
    if (gap >= LONG_NO_CAST_GAP_MS) {
      gaps.push(gap)
    }
  }

  return gaps
}

const buildPlayerReviewSourceNote = (limitations: string[]): string => {
  if (!limitations.length) {
    return 'Player review includes evidence from available fight events with cautious interpretation.'
  }

  return `Data may be partial. ${limitations.join(' ')}`
}

const buildPlayerReviewFindings = (params: {
  deaths: WclFightDeathSummary[]
  openerCasts: WclPlayerReviewEvent[]
  longNoCastGapsMs: number[]
  consumableEvents: WclPlayerReviewEvent[]
  defensiveEvents: WclPlayerReviewEvent[]
  interruptEvents: WclPlayerReviewEvent[]
  dispelEvents: WclPlayerReviewEvent[]
  limitations: string[]
}): WclPlayerReviewFinding[] => {
  const findings: WclPlayerReviewFinding[] = []

  if (params.deaths.length) {
    findings.push({
      id: 'survivability-death-evidence',
      category: 'survivability',
      severity: params.deaths.length > 1 ? 'critical' : 'warning',
      confidence: 'medium',
      title: params.deaths.length > 1 ? 'Multiple deaths detected' : 'Death detected',
      summary:
        params.deaths.length > 1
          ? `Multiple deaths were recorded for this player in the pull. Review final lethal events and the previous ${DAMAGE_WINDOW_MS / 1000}s damage windows.`
          : `A death was recorded for this player in the pull. Review final lethal event and the previous ${DAMAGE_WINDOW_MS / 1000}s damage window.`,
      evidence: params.deaths.flatMap((death) => [
        {
          timestampRelativeMs: death.deathTimestampRelativeMs,
          eventType: 'death',
          abilityId: death.finalDamageEvent?.abilityId ?? null,
          abilityName: death.finalDamageEvent?.abilityName ?? 'Unknown ability',
          sourceName: death.finalDamageEvent?.sourceName ?? null,
          amount: death.finalDamageEvent?.amount ?? null,
        },
      ]),
    })
  }

  if (!params.openerCasts.length) {
    findings.push({
      id: 'execution-empty-opener',
      category: 'execution',
      severity: 'warning',
      confidence: 'medium',
      title: 'No opener casts detected',
      summary:
        'No player casts were detected in the first 45 seconds from available events. This may be affected by source event completeness.',
      evidence: [],
      limitation: 'Movement, downtime, or missing event pages can affect this signal.',
    })
  }

  if (params.longNoCastGapsMs.length) {
    findings.push({
      id: 'execution-long-gaps',
      category: 'execution',
      severity: 'warning',
      confidence: 'medium',
      title: 'Long no-cast gaps detected',
      summary: `Detected ${params.longNoCastGapsMs.length} gap(s) of ${LONG_NO_CAST_GAP_MS / 1000}s or longer between casts. Review movement, assignments, and fight downtime context.`,
      evidence: [],
      limitation: 'Long gaps are evidence for review, not definitive mistakes.',
    })
  }

  if (!params.consumableEvents.length) {
    findings.push({
      id: 'survivability-no-consumable-detected',
      category: 'survivability',
      severity: 'info',
      confidence: 'low',
      title: 'No recognized consumable event detected',
      summary: 'No recognized potion or healthstone event was detected from available fight events.',
      evidence: [],
      limitation: 'Consumable detection is generic and may miss some event patterns.',
    })
  }

  if (params.deaths.length && !params.defensiveEvents.length) {
    findings.push({
      id: 'survivability-no-defensive-detected',
      category: 'survivability',
      severity: 'warning',
      confidence: 'low',
      title: 'No recognized defensive event detected',
      summary:
        'No recognized defensive event was detected for this player from available events. Review manually alongside incoming damage windows.',
      evidence: [],
      limitation: 'Defensive detection is based on a small generic ability-name list.',
    })
  }

  if (params.interruptEvents.length || params.dispelEvents.length) {
    findings.push({
      id: 'utility-events-detected',
      category: 'utility',
      severity: 'info',
      confidence: 'medium',
      title: 'Utility events detected',
      summary: `Detected ${params.interruptEvents.length} recognized interrupt event(s) and ${params.dispelEvents.length} recognized dispel event(s).`,
      evidence: [...params.interruptEvents.slice(0, 3), ...params.dispelEvents.slice(0, 3)],
    })
  }

  if (params.limitations.length) {
    findings.push({
      id: 'confidence-partial-source',
      category: 'confidence',
      severity: 'info',
      confidence: 'high',
      title: 'Source limitations detected',
      summary: 'One or more evidence categories may be partial based on available source events.',
      evidence: [],
      limitation: params.limitations.join(' '),
    })
  }

  return findings
}

const toBossFightContext = (report: WclReportDetails): AggregatedFightContext[] =>
  report.fights
    .filter((fight) => fight.encounterId > 0)
    .map((fight) => {
      const absoluteStartTime = report.startTime + fight.startTime
      const absoluteEndTime = report.startTime + fight.endTime

      return {
        reportCode: report.code,
        reportTitle: report.title,
        reportStartTime: report.startTime,
        reportUrl: report.url,
        fightId: fight.id,
        encounterId: fight.encounterId,
        encounterName: fight.encounterName || `Unknown encounter ${fight.encounterId}`,
        kill: fight.kill,
        difficulty: fight.difficulty,
        startTime: absoluteStartTime,
        endTime: absoluteEndTime,
        durationMs: Math.max(absoluteEndTime - absoluteStartTime, 0),
      }
    })

const aggregateRecentBossData = async (
  config: WclConfig
): Promise<{
  source: AggregatedBossSource
  fights: AggregatedFightContext[]
}> => {
  const recentReports = await WclService.listRecentReports(config, RECENT_REPORT_LIMIT)

  if (!recentReports.length) {
    return {
      source: {
        reportCount: 0,
        note: buildAggregationNote({
          reportCount: 0,
          failedReportCount: 0,
        }),
      },
      fights: [],
    }
  }

  const reportDetailsResult = await Promise.allSettled(
    recentReports.map((report) => WclService.getReportDetails(config, report.code))
  )

  const successfulDetails = reportDetailsResult
    .filter((result): result is PromiseFulfilledResult<WclReportDetails> => result.status === 'fulfilled')
    .map((result) => result.value)

  const failedReportCount = reportDetailsResult.length - successfulDetails.length

  return {
    source: {
      reportCount: recentReports.length,
      note: buildAggregationNote({
        reportCount: recentReports.length,
        failedReportCount,
      }),
    },
    fights: successfulDetails.flatMap(toBossFightContext),
  }
}

export const WclService = {
  listRecentReports: async (config: WclConfig, limit = RECENT_REPORT_LIMIT): Promise<WclReportSummary[]> => {
    const queryResponse = await queryWclGraphQl<ReportsQueryResponse>({
      config,
      query: REPORTS_BY_GUILD_QUERY,
      variables: {
        guildId: Number(config.WCL_GUILD_ID),
        limit,
      },
    })

    const reports = queryResponse.reportData?.reports?.data ?? []

    return reports.map((report) => ({
      code: report.code,
      title: report.title,
      startTime: report.startTime,
      endTime: report.endTime,
      visibility: report.visibility,
      ownerName: report.owner?.name ?? null,
      zoneId: report.zone?.id ?? null,
      zoneName: report.zone?.name ?? null,
      url: `https://www.warcraftlogs.com/reports/${report.code}`,
    }))
  },

  getReportDetails: async (config: WclConfig, code: string): Promise<WclReportDetails> => {
    const queryResponse = await queryWclGraphQl<ReportDetailsQueryResponse>({
      config,
      query: REPORT_DETAILS_QUERY,
      variables: {
        code,
      },
    })

    const report = queryResponse.reportData?.report

    if (!report) {
      throw new Error(`No report found for code: ${code}`)
    }

    return {
      code: report.code,
      title: report.title,
      startTime: report.startTime,
      endTime: report.endTime,
      visibility: report.visibility,
      ownerName: report.owner?.name ?? null,
      zoneId: report.zone?.id ?? null,
      zoneName: report.zone?.name ?? null,
      fights: mapFights(report.fights),
      url: `https://www.warcraftlogs.com/reports/${report.code}`,
    }
  },

  getFightReview: async (config: WclConfig, code: string, fightId: number): Promise<WclFightReview> => {
    if (!Number.isFinite(fightId) || fightId <= 0) {
      throw createWclServiceError('Invalid fight ID. Expected a positive number.', 'BAD_REQUEST')
    }

    const reportDetails = await WclService.getReportDetails(config, code).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to load report details.'

      if (isNotFoundMessage(message)) {
        throw createWclServiceError(`No report found for code: ${code}`, 'NOT_FOUND')
      }

      throw createWclServiceError('Failed to load report details from Warcraft Logs.', 'UPSTREAM')
    })

    const fight = reportDetails.fights.find((fightItem) => fightItem.id === fightId)

    if (!fight) {
      throw createWclServiceError(`Fight ${fightId} was not found for report ${code}.`, 'NOT_FOUND')
    }

    const queryResponse = await queryWclGraphQl<FightReviewQueryResponse>({
      config,
      query: FIGHT_REVIEW_QUERY,
      variables: {
        code,
        fightId,
        startTime: fight.startTime,
        endTime: fight.endTime,
      },
    }).catch(() => {
      throw createWclServiceError('Failed to load fight event evidence from Warcraft Logs.', 'UPSTREAM')
    })

    const report = queryResponse.reportData?.report

    if (!report) {
      throw createWclServiceError(`No report found for code: ${code}`, 'NOT_FOUND')
    }

    const selectedFight = report.fights?.find((fightItem) => fightItem.id === fightId)

    if (!selectedFight) {
      throw createWclServiceError(`Fight ${fightId} was not found for report ${code}.`, 'NOT_FOUND')
    }

    const actorById = toActorMap(report.masterData?.actors ?? [])
    const participants = mapParticipants(report.masterData?.actors ?? []).filter(
      (participant) => participant.type === 'Player' || participant.className != null
    )

    const playerActorIds = new Set(participants.map((p) => p.id))

    const deaths = (report.deaths?.data ?? []).filter(
      (event) => typeof event.targetID === 'number' && playerActorIds.has(event.targetID)
    )
    const damageTaken = report.damageTaken?.data ?? []

    const mappedDeaths = mapFightDeaths({
      deaths,
      damageTaken,
      actorById,
      fightStartTime: selectedFight.startTime,
      reportStartTime: report.startTime,
    })

    const participantPartial = participants.length === 0
    const deathsPartial = Boolean(report.deaths?.nextPageTimestamp || report.damageTaken?.nextPageTimestamp)

    const absoluteStartTime = report.startTime + selectedFight.startTime
    const absoluteEndTime = report.startTime + selectedFight.endTime

    return {
      reportCode: report.code,
      reportTitle: report.title,
      reportUrl: `https://www.warcraftlogs.com/reports/${report.code}`,
      fightId: selectedFight.id,
      encounterId: selectedFight.encounterID,
      encounterName: selectedFight.name ?? `Unknown encounter ${selectedFight.encounterID}`,
      kill: selectedFight.kill,
      difficulty: selectedFight.difficulty,
      startTime: absoluteStartTime,
      endTime: absoluteEndTime,
      durationMs: Math.max(absoluteEndTime - absoluteStartTime, 0),
      participants,
      deaths: mappedDeaths,
      source: {
        note: buildSourceNote({
          participantPartial,
          deathsPartial,
        }),
        partial: participantPartial || deathsPartial,
      },
    }
  },

  getPlayerFightReview: async (
    config: WclConfig,
    code: string,
    fightId: number,
    playerId: number
  ): Promise<WclPlayerFightReview> => {
    if (!Number.isFinite(fightId) || fightId <= 0) {
      throw createWclServiceError('Invalid fight ID. Expected a positive number.', 'BAD_REQUEST')
    }

    if (!Number.isFinite(playerId) || playerId <= 0) {
      throw createWclServiceError('Invalid player ID. Expected a positive number.', 'BAD_REQUEST')
    }

    const reportDetails = await WclService.getReportDetails(config, code).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Failed to load report details.'

      if (isNotFoundMessage(message)) {
        throw createWclServiceError(`No report found for code: ${code}`, 'NOT_FOUND')
      }

      throw createWclServiceError('Failed to load report details from Warcraft Logs.', 'UPSTREAM')
    })

    const fight = reportDetails.fights.find((fightItem) => fightItem.id === fightId)

    if (!fight) {
      throw createWclServiceError(`Fight ${fightId} was not found for report ${code}.`, 'NOT_FOUND')
    }

    const queryResponse = await queryWclGraphQl<PlayerReviewQueryResponse>({
      config,
      query: PLAYER_REVIEW_QUERY,
      variables: {
        code,
        fightId,
        startTime: fight.startTime,
        endTime: fight.endTime,
      },
    }).catch(() => {
      throw createWclServiceError('Failed to load player fight review evidence from Warcraft Logs.', 'UPSTREAM')
    })

    const report = queryResponse.reportData?.report

    if (!report) {
      throw createWclServiceError(`No report found for code: ${code}`, 'NOT_FOUND')
    }

    const selectedFight = report.fights?.find((fightItem) => fightItem.id === fightId)

    if (!selectedFight) {
      throw createWclServiceError(`Fight ${fightId} was not found for report ${code}.`, 'NOT_FOUND')
    }

    const actorById = toActorMap(report.masterData?.actors ?? [])
    const selectedPlayer = actorById.get(playerId)

    if (!selectedPlayer || (selectedPlayer.type !== 'Player' && !selectedPlayer.subType)) {
      throw createWclServiceError(`Player ${playerId} was not found in fight ${fightId}.`, 'NOT_FOUND')
    }

    const fightDurationMs = Math.max(selectedFight.endTime - selectedFight.startTime, 0)
    const absoluteStartTime = report.startTime + selectedFight.startTime
    const absoluteEndTime = report.startTime + selectedFight.endTime

    const castsRaw = report.casts?.data ?? []
    const damageDoneRaw = report.damageDone?.data ?? []
    const damageTakenRaw = report.damageTaken?.data ?? []
    const deathsRaw = report.deaths?.data ?? []
    const buffsRaw = report.buffs?.data ?? []

    const playerCastEvents = mapPlayerEvents({
      events: filterEventsByPlayer({ events: castsRaw, playerId, mode: 'source' }),
      fightStartTime: selectedFight.startTime,
      eventType: 'cast',
      actorById,
    })

    const playerDamageDoneEvents = mapPlayerEvents({
      events: filterEventsByPlayer({ events: damageDoneRaw, playerId, mode: 'source' }),
      fightStartTime: selectedFight.startTime,
      eventType: 'damageDone',
      actorById,
    })

    const playerDamageTakenEvents = mapPlayerEvents({
      events: filterEventsByPlayer({ events: damageTakenRaw, playerId, mode: 'target' }),
      fightStartTime: selectedFight.startTime,
      eventType: 'damageTaken',
      actorById,
    })

    const playerBuffEvents = mapPlayerEvents({
      events: filterEventsByPlayer({ events: buffsRaw, playerId, mode: 'either' }),
      fightStartTime: selectedFight.startTime,
      eventType: 'buff',
      actorById,
    })

    const playerDeaths = mapFightDeaths({
      deaths: filterEventsByPlayer({ events: deathsRaw, playerId, mode: 'target' }),
      damageTaken: filterEventsByPlayer({ events: damageTakenRaw, playerId, mode: 'target' }),
      actorById,
      fightStartTime: selectedFight.startTime,
      reportStartTime: report.startTime,
    })

    const knownCastEvents = playerCastEvents.filter((event) => event.abilityName !== 'Unknown ability')
    const unknownAbilityCount = playerCastEvents.length - knownCastEvents.length

    const openerEvents = knownCastEvents.filter((event) => event.timestampRelativeMs <= OPENER_WINDOW_MS)
    const longNoCastGapsMs = calculateLongNoCastGaps(knownCastEvents)

    const consumableEvents = playerBuffEvents.filter((event) => includesKnownToken(event.abilityName, CONSUMABLE_ABILITY_NAMES))
    const defensiveEvents = playerBuffEvents.filter((event) => includesKnownToken(event.abilityName, DEFENSIVE_ABILITY_NAMES))
    const interruptEvents = knownCastEvents.filter((event) => includesKnownToken(event.abilityName, INTERRUPT_ABILITY_NAMES))
    const dispelEvents = knownCastEvents.filter((event) => includesKnownToken(event.abilityName, DISPEL_ABILITY_NAMES))

    const totalDamageDone = playerDamageDoneEvents.reduce((sum, event) => sum + (event.amount ?? 0), 0)
    const castCount = knownCastEvents.length
    const castsPerMinute = fightDurationMs > 0 ? Number(((castCount * 60_000) / fightDurationMs).toFixed(2)) : 0

    const limitations: string[] = []

    if (report.casts?.nextPageTimestamp) {
      limitations.push('Cast events may be partial because event pagination returned additional pages.')
    }

    if (report.damageDone?.nextPageTimestamp) {
      limitations.push('Damage done events may be partial because event pagination returned additional pages.')
    }

    if (report.damageTaken?.nextPageTimestamp) {
      limitations.push('Damage taken events may be partial because event pagination returned additional pages.')
    }

    if (report.deaths?.nextPageTimestamp) {
      limitations.push('Death events may be partial because event pagination returned additional pages.')
    }

    if (report.buffs?.nextPageTimestamp) {
      limitations.push('Buff/consumable/defensive evidence may be partial because event pagination returned additional pages.')
    }

    if (unknownAbilityCount > 0) {
      limitations.push(
        `${unknownAbilityCount} cast event(s) had no ability name from WCL and were excluded from the cast timeline.`
      )
    }

    limitations.push('Assignment context is unknown and may change interpretation of activity and utility events.')

    const findings = buildPlayerReviewFindings({
      deaths: playerDeaths,
      openerCasts: openerEvents,
      longNoCastGapsMs,
      consumableEvents,
      defensiveEvents,
      interruptEvents,
      dispelEvents,
      limitations,
    })

    const sourceNote = buildPlayerReviewSourceNote(limitations)

    return {
      reportCode: report.code,
      reportTitle: report.title,
      reportUrl: `https://www.warcraftlogs.com/reports/${report.code}`,
      fight: {
        id: selectedFight.id,
        encounterId: selectedFight.encounterID,
        encounterName: selectedFight.name ?? `Unknown encounter ${selectedFight.encounterID}`,
        kill: selectedFight.kill,
        difficulty: selectedFight.difficulty,
        startTime: absoluteStartTime,
        endTime: absoluteEndTime,
        durationMs: fightDurationMs,
      },
      player: {
        id: selectedPlayer.id,
        name: selectedPlayer.name ?? `Unknown player ${selectedPlayer.id}`,
        type: selectedPlayer.type ?? null,
        className: selectedPlayer.subType ?? null,
        icon: selectedPlayer.icon ?? null,
      },
      assignmentContext: {
        status: 'Unknown',
        note: 'Assignment context is unknown in PR03. Interpretation may change when assignment tagging exists.',
      },
      evidence: {
        context: {
          summary: 'Assignment and mechanic responsibility context is not available in PR03.',
          confidence: 'low',
          limitations: ['Assignment tags are not implemented yet.'],
        },
        output: {
          summary: `Detected ${playerDamageDoneEvents.length} damage-done evidence events from available data.`,
          confidence: report.damageDone?.nextPageTimestamp ? 'low' : 'medium',
          limitations: report.damageDone?.nextPageTimestamp
            ? ['Damage done events may be partial due to pagination.']
            : [],
          damageDoneEvents: playerDamageDoneEvents.slice(0, 25),
          totalDamageDone,
        },
        execution: {
          summary: `Detected ${castCount} cast events with ${longNoCastGapsMs.length} long no-cast gap(s).`,
          confidence: report.casts?.nextPageTimestamp ? 'low' : 'medium',
          limitations: report.casts?.nextPageTimestamp
            ? ['Cast events may be partial due to pagination.']
            : ['Long no-cast gaps can be caused by movement, downtime, or assignments.'],
          openerEvents,
          casts: knownCastEvents.slice(0, 120),
          castCount,
          castsPerMinute,
          longNoCastGapsMs,
        },
        survivability: {
          summary: `Detected ${playerDeaths.length} death event(s), ${playerDamageTakenEvents.length} damage-taken event(s), and ${defensiveEvents.length} recognized defensive event(s).`,
          confidence: report.damageTaken?.nextPageTimestamp || report.deaths?.nextPageTimestamp ? 'low' : 'medium',
          limitations:
            report.damageTaken?.nextPageTimestamp || report.deaths?.nextPageTimestamp
              ? ['Damage taken and/or death windows may be partial due to pagination.']
              : ['Defensive and consumable detection uses generic ability-name matching.'],
          deaths: playerDeaths,
          damageTakenEvents: playerDamageTakenEvents.slice(0, 80),
          defensiveEvents: defensiveEvents.slice(0, 30),
          consumableEvents: consumableEvents.slice(0, 30),
        },
        utility: {
          summary: `Detected ${interruptEvents.length} recognized interrupt event(s) and ${dispelEvents.length} recognized dispel event(s) from available events.`,
          confidence: 'low',
          limitations: ['Utility detection is generic and based on recognizable cast names in available events.'],
          interrupts: interruptEvents,
          dispels: dispelEvents,
        },
        consistency: {
          summary: 'Consistency/trend evidence is a placeholder in PR03 and requires multi-pull historical context.',
          confidence: 'low',
          limitations: ['Cross-pull trend analysis is out of scope for PR03.'],
        },
        confidence: {
          summary: sourceNote,
          confidence: limitations.length ? 'low' : 'medium',
          limitations,
        },
      },
      topFindings: findings,
      source: {
        note: sourceNote,
        partial: Boolean(
          report.casts?.nextPageTimestamp ||
            report.damageDone?.nextPageTimestamp ||
            report.damageTaken?.nextPageTimestamp ||
            report.deaths?.nextPageTimestamp ||
            report.buffs?.nextPageTimestamp
        ),
        limitations,
      },
    }
  },

  listRecentBosses: async (config: WclConfig): Promise<WclRecentBossesResponse> => {
    const aggregatedData = await aggregateRecentBossData(config)
    const bossMap = new Map<number, WclBossSummary>()

    aggregatedData.fights.forEach((fight) => {
      const existingBoss = bossMap.get(fight.encounterId)

      if (!existingBoss) {
        bossMap.set(fight.encounterId, {
          encounterId: fight.encounterId,
          encounterName: fight.encounterName || `Unknown encounter ${fight.encounterId}`,
          pullCount: 1,
          killCount: fight.kill ? 1 : 0,
          wipeCount: fight.kill ? 0 : 1,
          lastSeenAt: fight.startTime,
          difficulties: [fight.difficulty],
          recentReports: [
            {
              code: fight.reportCode,
              title: fight.reportTitle,
              startTime: fight.reportStartTime,
            },
          ],
        })
        return
      }

      existingBoss.pullCount += 1
      existingBoss.killCount += fight.kill ? 1 : 0
      existingBoss.wipeCount += fight.kill ? 0 : 1
      existingBoss.lastSeenAt = Math.max(existingBoss.lastSeenAt, fight.startTime)

      if (!existingBoss.difficulties.includes(fight.difficulty)) {
        existingBoss.difficulties.push(fight.difficulty)
      }

      if (!existingBoss.recentReports.some((report) => report.code === fight.reportCode)) {
        existingBoss.recentReports.push({
          code: fight.reportCode,
          title: fight.reportTitle,
          startTime: fight.reportStartTime,
        })
      }
    })

    const bosses = Array.from(bossMap.values())
      .map((boss) => ({
        ...boss,
        difficulties: [...boss.difficulties].sort((left, right) => left - right),
        recentReports: [...boss.recentReports]
          .sort((left, right) => right.startTime - left.startTime)
          .slice(0, 5),
      }))
      .sort((left, right) => {
        if (right.lastSeenAt !== left.lastSeenAt) {
          return right.lastSeenAt - left.lastSeenAt
        }

        return left.encounterName.localeCompare(right.encounterName)
      })

    return {
      generatedAt: Date.now(),
      source: aggregatedData.source,
      bosses,
    }
  },

  listRecentBossFights: async (
    config: WclConfig,
    encounterId: number
  ): Promise<WclRecentBossFightsResponse> => {
    const aggregatedData = await aggregateRecentBossData(config)

    const fights: WclBossFightListItem[] = aggregatedData.fights
      .filter((fight) => fight.encounterId === encounterId)
      .sort((left, right) => right.startTime - left.startTime)
      .map((fight) => ({
        reportCode: fight.reportCode,
        reportTitle: fight.reportTitle,
        reportStartTime: fight.reportStartTime,
        fightId: fight.fightId,
        encounterId: fight.encounterId,
        encounterName: fight.encounterName || `Unknown encounter ${fight.encounterId}`,
        kill: fight.kill,
        difficulty: fight.difficulty,
        startTime: fight.startTime,
        endTime: fight.endTime,
        durationMs: fight.durationMs,
        url: fight.reportUrl,
      }))

    return {
      generatedAt: Date.now(),
      source: aggregatedData.source,
      boss: {
        encounterId,
        encounterName: fights[0]?.encounterName ?? `Unknown encounter ${encounterId}`,
      },
      fights,
    }
  },

  getRecentPlayers: async (config: WclConfig, limit = RECENT_REPORT_LIMIT): Promise<WclRecentPlayer[]> => {
    const reports = await WclService.listRecentReports(config, limit)
    const raidReports = reports.filter(isRaidZone)
    const scopedReports = raidReports.length > 0 ? raidReports : reports
    const playerMap = new Map<string, WclRecentPlayer>()

    if (scopedReports.length === 0) {
      return []
    }

    const reportDetailsResults = await Promise.allSettled(
      scopedReports.map(async (report) => {
        const details = await WclService.getReportDetails(config, report.code)
        const raidKillFights = details.fights.filter((fight) => fight.encounterId > 0 && fight.kill).length
        return { report, raidKillFights }
      })
    )

    const resolvedReports = reportDetailsResults
      .filter((result): result is PromiseFulfilledResult<{ report: WclReportSummary; raidKillFights: number }> => result.status === 'fulfilled')
      .map((result) => result.value)

    const raidKillReports = resolvedReports
      .filter((entry) => entry.raidKillFights > 0)

    const sourceReports = raidKillReports.length > 0 ? raidKillReports : resolvedReports

    await Promise.all(
      sourceReports.map(async ({ report, raidKillFights }) => {
        try {
          const response = await queryWclGraphQl<ReportPlayersQueryResponse>({
            config,
            query: REPORT_PLAYERS_QUERY,
            variables: { code: report.code },
          })

          const actors = response.reportData?.report?.masterData?.actors ?? []
          actors
            .filter((actor) => actor.type === 'Player' && actor.name)
            .forEach((actor) => {
              const name = actor.name ?? 'Unknown Player'
              const normalizedName = name.toLowerCase()
              const existing = playerMap.get(normalizedName)

              if (!existing) {
                playerMap.set(normalizedName, {
                  name,
                  className: actor.subType ?? null,
                  specName: null,
                  role: 'unknown',
                  seenInReportCodes: [report.code],
                  lastSeenAt: report.startTime,
                  seenInRaidKillReports: raidKillFights > 0 ? 1 : 0,
                  seenInRaidKillFights: raidKillFights,
                })
                return
              }

              if (!existing.seenInReportCodes.includes(report.code)) {
                existing.seenInReportCodes.push(report.code)
                existing.seenInRaidKillReports = (existing.seenInRaidKillReports ?? 0) + (raidKillFights > 0 ? 1 : 0)
                existing.seenInRaidKillFights = (existing.seenInRaidKillFights ?? 0) + raidKillFights
              }
              existing.lastSeenAt = Math.max(existing.lastSeenAt ?? 0, report.startTime)
              if (!existing.className && actor.subType) {
                existing.className = actor.subType
                existing.role = 'unknown'
              }
            })
        } catch {
          // Partial failures are intentionally skipped for resilient aggregation.
        }
      })
    )

    return Array.from(playerMap.values()).sort((left, right) => {
      const reportDelta = (right.seenInRaidKillReports ?? 0) - (left.seenInRaidKillReports ?? 0)
      if (reportDelta !== 0) return reportDelta
      const fightDelta = (right.seenInRaidKillFights ?? 0) - (left.seenInRaidKillFights ?? 0)
      if (fightDelta !== 0) return fightDelta
      const seenDelta = (right.lastSeenAt ?? 0) - (left.lastSeenAt ?? 0)
      if (seenDelta !== 0) return seenDelta
      return left.name.localeCompare(right.name)
    })
  },

  getPlayerReviewScopePreview: async (
    config: WclConfig,
    request: WclPlayerReviewScopePreviewRequest
  ): Promise<WclPlayerReviewScopePreview> => {
    const playerName = request.playerName?.trim()
    if (!playerName) {
      throw createWclServiceError('Missing playerName.', 'BAD_REQUEST')
    }

    const includeKills = request.includeKills ?? true
    const includeWipes = request.includeWipes ?? true
    const includeTrash = request.includeTrash ?? false
    const onlyPlayerPresent = request.onlyPlayerPresent ?? true
    const reportsInput = request.reportCodes?.length
      ? request.reportCodes
      : (await WclService.listRecentReports(config, PLAYER_REVIEW_HARD_LIMITS.maxReports)).map((report) => report.code)

    const warnings: string[] = []
    const includedReports: WclPlayerReviewScopePreview['includedReports'] = []
    let fightsScanned = 0
    let fightsIncluded = 0
    let fightsSkippedBecausePlayerAbsent = 0
    const fightsSkippedByDate = 0
    let fightsSkippedByKillWipeFilter = 0

    const reportResults = await Promise.allSettled(reportsInput.map((code) => WclService.getReportDetails(config, code)))
    const reports = reportResults.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))

    for (const report of reports) {
      const reportWarnings: string[] = []
      const playersQuery = await queryWclGraphQl<ReportPlayersQueryResponse>({
        config,
        query: REPORT_PLAYERS_QUERY,
        variables: { code: report.code },
      }).catch(() => null)
      const actors = playersQuery?.reportData?.report?.masterData?.actors ?? []
      const reportHasPlayer = actors.some(
        (actor) => actor.type === 'Player' && actor.name?.toLowerCase() === playerName.toLowerCase()
      )

      const includedFightIds: number[] = []
      const skippedFightIds: number[] = []

      for (const fight of report.fights) {
        fightsScanned += 1
        if (!includeTrash && fight.encounterId <= 0) {
          skippedFightIds.push(fight.id)
          continue
        }
        if ((fight.kill && !includeKills) || (!fight.kill && !includeWipes)) {
          fightsSkippedByKillWipeFilter += 1
          skippedFightIds.push(fight.id)
          continue
        }
        if (onlyPlayerPresent && !reportHasPlayer) {
          fightsSkippedBecausePlayerAbsent += 1
          skippedFightIds.push(fight.id)
          continue
        }
        includedFightIds.push(fight.id)
      }

      if (!reportHasPlayer) {
        reportWarnings.push(`Player ${playerName} was not found in report roster.`)
      }

      fightsIncluded += includedFightIds.length
      includedReports.push({
        code: report.code,
        title: report.title,
        startTime: report.startTime,
        url: report.url,
        playerPresent: reportHasPlayer,
        includedFightIds,
        skippedFightIds,
        warnings: reportWarnings,
      })
    }

    const estimatedPayloadLevel = fightsIncluded > 24 ? 'large' : fightsIncluded > 10 ? 'medium' : 'small'

    return {
      playerName,
      scopePreset: request.scopePreset,
      since: request.since,
      until: request.until,
      reportsScanned: reportsInput.length,
      reportsIncluded: includedReports.filter((report) => report.includedFightIds.length > 0).length,
      fightsScanned,
      fightsIncluded,
      fightsSkippedBecausePlayerAbsent,
      fightsSkippedByDate,
      fightsSkippedByKillWipeFilter,
      estimatedPayloadLevel,
      roleInference: buildUnknownRoleMetadata(),
      includedReports,
      warnings,
    }
  },

  getPlayerReviewSnapshot: async (
    config: WclConfig,
    request: WclPlayerReviewSnapshotRequest
  ): Promise<WclPlayerReviewSnapshot> => {
    const playerName = request.playerName?.trim()
    if (!playerName) {
      throw createWclServiceError('Missing playerName.', 'BAD_REQUEST')
    }

    const preview = await WclService.getPlayerReviewScopePreview(config, {
      playerName,
      scopePreset: request.scopePreset,
      since: request.since,
      until: request.until,
      reportCodes: request.reportCodes,
      includeKills: request.includeKills,
      includeWipes: request.includeWipes,
      includeTrash: request.includeTrash,
      onlyPlayerPresent: request.onlyPlayerPresent,
      maxReports: request.maxReports,
      maxFights: request.maxFights,
    })

    const warnings: string[] = []

    const reportDetailsResults = await Promise.allSettled(
      preview.includedReports.map(async (report) => WclService.getReportDetails(config, report.code))
    )

    const reports = reportDetailsResults.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    reportDetailsResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        warnings.push(`Could not load report ${preview.includedReports[index]?.code ?? 'unknown'}.`) 
      }
    })

    const snapshotReports = reports.map((report) => ({
      code: report.code,
      title: report.title,
      url: report.url,
      startTime: report.startTime,
    }))

    const possibleActorIds: Array<{ reportCode: string; actorId: number }> = []
    const fightSnapshots: WclPlayerFightSnapshot[] = []
    const damageTakenAggregate = new Map<string, { count: number; total: number }>()
    const defensiveAggregate = new Map<string, number>()
    let deaths = 0
    let earlyDeaths = 0
    let killsReviewed = 0
    let wipesReviewed = 0
    let throughputDpsTotal = 0
    let throughputDpsCount = 0

    for (const report of reports) {
      const playersQuery = await queryWclGraphQl<ReportPlayersQueryResponse>({
        config,
        query: REPORT_PLAYERS_QUERY,
        variables: { code: report.code },
      }).catch(() => null)

      const actors = playersQuery?.reportData?.report?.masterData?.actors ?? []
      const matchingActors = actors.filter(
        (actor) => actor.type === 'Player' && actor.name?.toLowerCase() === playerName.toLowerCase() && actor.id > 0
      )

      matchingActors.forEach((actor) => possibleActorIds.push({ reportCode: report.code, actorId: actor.id }))

      if (!matchingActors.length) {
        warnings.push(`Player ${playerName} was not found in report ${report.code}.`)
      }

      const reportScope = preview.includedReports.find((item) => item.code === report.code)
      const allowedFightIds = new Set(reportScope?.includedFightIds ?? [])
      const explicitFightIds = request.fightIdsByReport?.[report.code]

      const filteredFights = report.fights.filter((fight) => {
        if (!allowedFightIds.has(fight.id)) {
          return false
        }
        if (explicitFightIds?.length && !explicitFightIds.includes(fight.id)) {
          return false
        }
        return true
      })

      for (const fight of filteredFights) {
        if (fight.kill) {
          killsReviewed += 1
        } else {
          wipesReviewed += 1
        }

        const playerActorId = matchingActors[0]?.id
        if (!playerActorId) {
          fightSnapshots.push({
            reportCode: report.code,
            reportUrl: report.url,
            fightId: fight.id,
            encounterId: fight.encounterId,
            encounterName: fight.encounterName,
            kill: fight.kill,
            difficulty: fight.difficulty,
            durationMs: Math.max(fight.endTime - fight.startTime, 0),
            playerPresent: false,
            playerDied: false,
            damageTaken: [],
            deaths: [],
            casts: [],
            buffs: [],
            notes: [],
            warnings: ['Player not present in this report/fight.'],
          })
          continue
        }

        const playerReview = await WclService.getPlayerFightReview(config, report.code, fight.id, playerActorId).catch(() => null)

        if (!playerReview) {
          warnings.push(`Could not fetch detailed events for report ${report.code} fight ${fight.id}.`)
          fightSnapshots.push({
            reportCode: report.code,
            reportUrl: report.url,
            fightId: fight.id,
            encounterId: fight.encounterId,
            encounterName: fight.encounterName,
            kill: fight.kill,
            difficulty: fight.difficulty,
            durationMs: Math.max(fight.endTime - fight.startTime, 0),
            playerPresent: true,
            playerDied: false,
            damageTaken: [],
            deaths: [],
            casts: [],
            buffs: [],
            notes: [],
            warnings: ['Detailed event data unavailable for this fight.'],
          })
          continue
        }

        const damageTakenByAbility = new Map<string, { total: number; hits: number }>()
        playerReview.evidence.survivability.damageTakenEvents.forEach((event) => {
          const ability = event.abilityName || 'Unknown ability'
          const current = damageTakenByAbility.get(ability) ?? { total: 0, hits: 0 }
          current.total += event.amount ?? 0
          current.hits += 1
          damageTakenByAbility.set(ability, current)
        })

        const castsByAbility = new Map<string, number>()
        playerReview.evidence.execution.casts.forEach((event) => {
          castsByAbility.set(event.abilityName, (castsByAbility.get(event.abilityName) ?? 0) + 1)
        })

        const playerDeaths = playerReview.evidence.survivability.deaths.map((death) => ({
          timestampMs: death.deathTimestampRelativeMs,
          killingBlow: death.finalDamageEvent?.abilityName ?? null,
          lastDamageEvents: death.recentDamageEvents.slice(-1 * (request.maxEventsBeforeDeath ?? PLAYER_REVIEW_DEFAULT_LIMITS.maxEventsBeforeDeath)).map((event) => ({
            secondsBeforeDeath: Number(((death.deathTimestampRelativeMs - event.timestampRelativeMs) / 1000).toFixed(1)),
            abilityName: event.abilityName,
            amount: event.amount ?? 0,
            sourceName: event.sourceName ?? null,
          })),
          healingReceivedBeforeDeath: [],
          defensiveBuffsActive: [],
        }))

        deaths += playerDeaths.length
        if (playerDeaths.some((death) => death.timestampMs <= 45_000)) {
          earlyDeaths += 1
        }

        playerReview.evidence.survivability.damageTakenEvents.forEach((event) => {
          const entry = damageTakenAggregate.get(event.abilityName) ?? { count: 0, total: 0 }
          entry.count += 1
          entry.total += event.amount ?? 0
          damageTakenAggregate.set(event.abilityName, entry)
        })

        playerReview.evidence.survivability.defensiveEvents.forEach((event) => {
          defensiveAggregate.set(event.abilityName, (defensiveAggregate.get(event.abilityName) ?? 0) + 1)
        })

        const dps = playerReview.evidence.output.totalDamageDone && fight.endTime > fight.startTime
          ? Number(((playerReview.evidence.output.totalDamageDone * 1000) / (fight.endTime - fight.startTime)).toFixed(2))
          : null
        if (dps != null) {
          throughputDpsTotal += dps
          throughputDpsCount += 1
        }

        fightSnapshots.push({
          reportCode: report.code,
          reportUrl: report.url,
          fightId: fight.id,
          encounterId: fight.encounterId,
          encounterName: fight.encounterName,
          kill: fight.kill,
          difficulty: fight.difficulty,
          durationMs: Math.max(fight.endTime - fight.startTime, 0),
          playerPresent: true,
          playerDied: playerDeaths.length > 0,
          deathTimeMs: playerDeaths[0]?.timestampMs ?? null,
          throughput: {
            damageDone: playerReview.evidence.output.totalDamageDone,
            dps,
            healingDone: null,
            hps: null,
            activeTimePercent: null,
          },
          damageTaken: Array.from(damageTakenByAbility.entries())
            .map(([abilityName, value]) => ({ abilityName, total: value.total, hits: value.hits }))
            .sort((a, b) => b.total - a.total)
            .slice(0, request.maxDamageTakenAbilities ?? PLAYER_REVIEW_DEFAULT_LIMITS.maxDamageTakenAbilities),
          deaths: playerDeaths,
          casts: Array.from(castsByAbility.entries())
            .map(([abilityName, count]) => ({ abilityName, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, request.maxCasts ?? PLAYER_REVIEW_DEFAULT_LIMITS.maxCasts),
          buffs: [],
          notes: playerReview.topFindings.map((finding) => finding.summary).slice(0, 3),
          warnings: playerReview.source.limitations,
        })
      }
    }

    if (!fightSnapshots.length) {
      warnings.push('No fights matched the selected filters.')
    }

    const firstPlayerClass = reports.length
      ? (await queryWclGraphQl<ReportPlayersQueryResponse>({ config, query: REPORT_PLAYERS_QUERY, variables: { code: reports[0].code } })
          .then((response) =>
            response.reportData?.report?.masterData?.actors?.find(
              (actor) => actor.type === 'Player' && actor.name?.toLowerCase() === playerName.toLowerCase()
            )?.subType ?? null
          )
          .catch(() => null))
      : null

    return {
      player: {
        name: playerName,
        className: firstPlayerClass,
        specName: null,
        role: 'unknown',
        possibleActorIds,
      },
      roleMetadata: buildUnknownRoleMetadata(),
      scopeSummary: {
        requestedPlayerName: playerName,
        scopePreset: preview.scopePreset,
        since: preview.since,
        until: preview.until,
        onlyPlayerPresent: request.onlyPlayerPresent ?? true,
        reportsScanned: preview.reportsScanned,
        reportsIncluded: preview.reportsIncluded,
        fightsScanned: preview.fightsScanned,
        fightsIncluded: preview.fightsIncluded,
        fightsSkippedBecausePlayerAbsent: preview.fightsSkippedBecausePlayerAbsent,
        fightsSkippedByDate: preview.fightsSkippedByDate,
        fightsSkippedByKillWipeFilter: preview.fightsSkippedByKillWipeFilter,
        payloadLimitsApplied: [
          `maxEventsBeforeDeath=${request.maxEventsBeforeDeath ?? PLAYER_REVIEW_DEFAULT_LIMITS.maxEventsBeforeDeath}`,
          `maxDamageTakenAbilities=${request.maxDamageTakenAbilities ?? PLAYER_REVIEW_DEFAULT_LIMITS.maxDamageTakenAbilities}`,
          `maxCasts=${request.maxCasts ?? PLAYER_REVIEW_DEFAULT_LIMITS.maxCasts}`,
        ],
        warnings: preview.warnings,
      },
      reports: snapshotReports,
      fights: fightSnapshots,
      aggregate: {
        pullsReviewed: fightSnapshots.length,
        killsReviewed,
        wipesReviewed,
        deaths,
        earlyDeaths,
        averageDps: throughputDpsCount > 0 ? Number((throughputDpsTotal / throughputDpsCount).toFixed(2)) : null,
        averageHps: null,
        majorDamageTakenAbilities: Array.from(damageTakenAggregate.entries())
          .map(([abilityName, value]) => ({ abilityName, count: value.count, total: value.total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 12),
        defensiveUses: Array.from(defensiveAggregate.entries())
          .map(([abilityName, count]) => ({ abilityName, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 12),
        interruptCount: null,
        dispelCount: null,
      },
      warnings: [...warnings, ...preview.warnings, UNKNOWN_ROLE_WARNING],
    }
  },

  generatePlayerReviewPrompt: (snapshot: WclPlayerReviewSnapshot): string => buildPlayerReviewPrompt(snapshot),
}
