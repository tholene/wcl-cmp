export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function buildCsvRow(headers: string[], row: Record<string, unknown>): string {
  return headers.map((h) => escapeCsvValue(row[h])).join(',')
}

export function buildCsvFile(headers: string[], rows: Record<string, unknown>[]): string {
  const headerLine = headers.join(',')
  const dataLines = rows.map((row) => buildCsvRow(headers, row))
  return [headerLine, ...dataLines].join('\n')
}

// ---------------------------------------------------------------------------
// Column definitions per view
// ---------------------------------------------------------------------------

export const FIGHTS_CSV_HEADERS = [
  'subjectType',
  'reportCode',
  'reportTitle',
  'fightId',
  'encounterId',
  'encounterName',
  'difficulty',
  'kill',
  'startTime',
  'endTime',
  'durationMs',
  'playerPresent',
  'sourceName',
  'sourceId',
  'className',
  'specName',
  'role',
  'itemLevel',
  'wclReportUrl',
]

export const COMBATANT_INFO_CSV_HEADERS = [
  'subjectType',
  'reportCode',
  'fightId',
  'sourceName',
  'sourceId',
  'className',
  'specName',
  'role',
  'itemLevel',
  'talentsJson',
  'gearJson',
  'rawJson',
]

// ---------------------------------------------------------------------------
// Common enriched event prefix — shared by all event-based views
// ---------------------------------------------------------------------------

const ENRICHED_EVENT_PREFIX = [
  'exportId',
  'subjectType',
  'reportCode',
  'reportTitle',
  'fightId',
  'encounterId',
  'encounterName',
  'difficulty',
  'kill',
  'fightDurationMs',
  'eventType',
  'timestampMs',
  'relativeTimestampMs',
  'sourceId',
  'sourceName',
  'sourceType',
  'sourceSubType',
  'sourceOwnerId',
  'sourceOwnerName',
  'targetId',
  'targetName',
  'targetType',
  'targetSubType',
  'targetOwnerId',
  'targetOwnerName',
  'abilityGameId',
  'abilityId',
  'abilityName',
  'abilityType',
  'rawAbilityGameId',
  'rawAbilityId',
  'rawAbilityName',
]

export const DAMAGE_DONE_CSV_HEADERS = [
  ...ENRICHED_EVENT_PREFIX,
  'amount',
  'absorbed',
  'mitigated',
  'blocked',
  'resisted',
  'overkill',
  'critical',
  'hitType',
  'rawEventJson',
]

export const DAMAGE_TAKEN_CSV_HEADERS = [
  ...ENRICHED_EVENT_PREFIX,
  'amount',
  'absorbed',
  'mitigated',
  'blocked',
  'resisted',
  'critical',
  'hitType',
  'rawEventJson',
]

export const CASTS_CSV_HEADERS = [
  ...ENRICHED_EVENT_PREFIX,
  'rawEventJson',
]

export const BUFFS_CSV_HEADERS = [
  ...ENRICHED_EVENT_PREFIX,
  'stack',
  'rawEventJson',
]

export const DEBUFFS_CSV_HEADERS = [
  ...ENRICHED_EVENT_PREFIX,
  'stack',
  'rawEventJson',
]

export const HEALING_CSV_HEADERS = [
  ...ENRICHED_EVENT_PREFIX,
  'amount',
  'overheal',
  'absorbed',
  'critical',
  'hitType',
  'rawEventJson',
]

export const DEATHS_CSV_HEADERS = [
  ...ENRICHED_EVENT_PREFIX,
  'deathTimestampMs',
  'deathRelativeTimestampMs',
  'killingBlowAbility',
  'killingBlowSource',
  'lastDamageEventsJson',
  'rawEventJson',
  'rawJson',
]

export const INTERRUPTS_CSV_HEADERS = [
  ...ENRICHED_EVENT_PREFIX,
  'rawEventJson',
]

export const DISPELS_CSV_HEADERS = [
  ...ENRICHED_EVENT_PREFIX,
  'rawEventJson',
]

export const RESOURCES_CSV_HEADERS = [
  ...ENRICHED_EVENT_PREFIX,
  'amount',
  'rawEventJson',
]

export const COMPARISON_SUMMARY_CSV_HEADERS = [
  'category',
  'metric',
  'playerValue',
  'benchmarkValue',
  'difference',
  'differencePct',
  'notes',
]
