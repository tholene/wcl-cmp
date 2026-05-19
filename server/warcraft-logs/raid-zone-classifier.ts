export type RaidZoneReport = {
  zoneId?: number | null
  zoneName?: string | null
}

export type RaidClassificationReason =
  | 'zoneIdAllowlist'
  | 'zoneNameAllowlist'
  | 'zoneAliasAllowlist'
  | 'raidHint'
  | 'nonRaidHint'
  | 'missingZoneName'
  | 'noRaidSignal'

export type RaidZoneClassification = {
  isRaid: boolean
  reason: RaidClassificationReason
  normalizedZoneName: string
  matchedSignal?: string
}

export type RaidZoneClassifierConfig = {
  raidZoneIds: number[]
  raidZoneNames: string[]
  raidZoneAliases: string[]
  raidNameHints: string[]
  nonRaidNameHints: string[]
}

export const RAID_ZONE_CLASSIFIER_CONFIG: RaidZoneClassifierConfig = {
  raidZoneIds: [
    26, // Castle Nathria
    27, // Sanctum of Domination
    28, // Sepulcher of the First Ones
    31, // Vault of the Incarnates
    33, // Aberrus, the Shadowed Crucible
    35, // Amirdrassil, the Dream's Hope
    38, // Nerub-ar Palace
    46, // Liberation of Undermine (often shown as VS / DR / MQD)
  ],
  raidZoneNames: [
    'castle nathria',
    'sanctum of domination',
    'sepulcher of the first ones',
    'vault of the incarnates',
    'aberrus, the shadowed crucible',
    "amirdrassil, the dream's hope",
    'nerub-ar palace',
    'liberation of undermine',
  ],
  raidZoneAliases: [
    'vs / dr / mqd',
    'vs/dr/mqd',
    'vs-dr-mqd',
    'vs / dr / mqd reclear',
    'mythic reclear',
    'hc raid',
  ],
  raidNameHints: [
    'raid',
    'palace',
    'vault',
    'sanctum',
    'sepulcher',
    'aberrus',
    'amirdrassil',
    'nathria',
    'undermine',
    'reclear',
    'mythic reclear',
    'heroic reclear',
    'prog',
  ],
  nonRaidNameHints: [
    'mythic+',
    'mythic plus',
    'dungeon',
    'keystone',
    'timewalking',
    'arena',
    'battleground',
    'skirmish',
  ],
}

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

export const normalizeZoneName = (value: string | null | undefined): string =>
  normalizeWhitespace((value ?? '').toLowerCase())

const toSet = (values: string[]): Set<string> =>
  new Set(values.map((value) => normalizeZoneName(value)).filter(Boolean))

const raidZoneIdSet = new Set<number>(RAID_ZONE_CLASSIFIER_CONFIG.raidZoneIds)
const raidZoneNameSet = toSet(RAID_ZONE_CLASSIFIER_CONFIG.raidZoneNames)
const raidZoneAliasSet = toSet(RAID_ZONE_CLASSIFIER_CONFIG.raidZoneAliases)

export const classifyRaidZone = (
  report: RaidZoneReport,
  config: RaidZoneClassifierConfig = RAID_ZONE_CLASSIFIER_CONFIG
): RaidZoneClassification => {
  const normalized = normalizeZoneName(report.zoneName)

  if (typeof report.zoneId === 'number' && raidZoneIdSet.has(report.zoneId)) {
    return {
      isRaid: true,
      reason: 'zoneIdAllowlist',
      normalizedZoneName: normalized,
      matchedSignal: `zoneId:${report.zoneId}`,
    }
  }

  if (!normalized) {
    return {
      isRaid: false,
      reason: 'missingZoneName',
      normalizedZoneName: normalized,
    }
  }

  if (raidZoneNameSet.has(normalized)) {
    return {
      isRaid: true,
      reason: 'zoneNameAllowlist',
      normalizedZoneName: normalized,
      matchedSignal: normalized,
    }
  }

  if (raidZoneAliasSet.has(normalized)) {
    return {
      isRaid: true,
      reason: 'zoneAliasAllowlist',
      normalizedZoneName: normalized,
      matchedSignal: normalized,
    }
  }

  const blockedHint = config.nonRaidNameHints.find((hint) => normalized.includes(hint))
  if (blockedHint) {
    return {
      isRaid: false,
      reason: 'nonRaidHint',
      normalizedZoneName: normalized,
      matchedSignal: blockedHint,
    }
  }

  const raidHint = config.raidNameHints.find((hint) => normalized.includes(hint))
  if (raidHint) {
    return {
      isRaid: true,
      reason: 'raidHint',
      normalizedZoneName: normalized,
      matchedSignal: raidHint,
    }
  }

  return {
    isRaid: false,
    reason: 'noRaidSignal',
    normalizedZoneName: normalized,
  }
}

export const isRaidZone = (report: RaidZoneReport): boolean => classifyRaidZone(report).isRaid
