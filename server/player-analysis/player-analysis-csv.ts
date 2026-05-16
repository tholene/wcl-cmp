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

export const DAMAGE_DONE_CSV_HEADERS = [
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
  'sourceId',
  'sourceName',
  'targetId',
  'targetName',
  'abilityGameId',
  'abilityName',
  'amount',
  'absorbed',
  'overkill',
  'timestampMs',
  'relativeTimestampMs',
]

export const DAMAGE_TAKEN_CSV_HEADERS = [
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
  'sourceId',
  'sourceName',
  'targetId',
  'targetName',
  'abilityGameId',
  'abilityName',
  'amount',
  'absorbed',
  'timestampMs',
  'relativeTimestampMs',
]

export const CASTS_CSV_HEADERS = [
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
  'sourceId',
  'sourceName',
  'targetId',
  'targetName',
  'abilityGameId',
  'abilityName',
  'timestampMs',
  'relativeTimestampMs',
]

export const BUFFS_CSV_HEADERS = [
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
  'sourceId',
  'sourceName',
  'targetId',
  'targetName',
  'abilityGameId',
  'abilityName',
  'eventType',
  'timestampMs',
  'relativeTimestampMs',
]

export const DEBUFFS_CSV_HEADERS = BUFFS_CSV_HEADERS

export const HEALING_CSV_HEADERS = [
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
  'sourceId',
  'sourceName',
  'targetId',
  'targetName',
  'abilityGameId',
  'abilityName',
  'amount',
  'overheal',
  'absorbed',
  'timestampMs',
  'relativeTimestampMs',
]

export const DEATHS_CSV_HEADERS = [
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
  'sourceId',
  'sourceName',
  'deathTimestampMs',
  'deathRelativeTimestampMs',
  'killingBlowAbility',
  'killingBlowSource',
  'lastDamageEventsJson',
  'rawJson',
]

export const INTERRUPTS_CSV_HEADERS = CASTS_CSV_HEADERS
export const DISPELS_CSV_HEADERS = CASTS_CSV_HEADERS

export const RESOURCES_CSV_HEADERS = [
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
  'sourceId',
  'sourceName',
  'abilityGameId',
  'abilityName',
  'amount',
  'timestampMs',
  'relativeTimestampMs',
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
