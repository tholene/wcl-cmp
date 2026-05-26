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
    1048, // Gruul / Magtheridon (TBC grouped raid zone label on Fresh/Classic)
    1056, // SSC / TK (TBC grouped raid zone label on Fresh/Classic)
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
    'ssc / tk',
    'gruul / magtheridon',
    'serpentshrine cavern',
    'tempest keep',
    'karazhan',
    'mount hyjal',
    'hyjal',
    'black temple',
    'sunwell',
    'sunwell plateau',
    'naxxramas',
    "ruins of ahn'qiraj",
    "temple of ahn'qiraj",
    'aq40',
    'molten core',
    'blackwing lair',
    "onyxia's lair",
    'onyxia',
  ],
  raidZoneAliases: [
    'vs / dr / mqd',
    'vs/dr/mqd',
    'vs-dr-mqd',
    'vs / dr / mqd reclear',
    'ssc/tk',
    'ssc-tk',
    'ssc tk',
    'gruul/magtheridon',
    'gruul-magtheridon',
    'gruul magtheridon',
    'aq 40',
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
    'serpentshrine',
    'tempest keep',
    'karazhan',
    'hyjal',
    'black temple',
    'sunwell',
    'naxxramas',
    "ahn'qiraj",
    'aq40',
    'molten core',
    'blackwing lair',
    'onyxia',
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

export const classifyRaidZone = (
  report: RaidZoneReport,
  config: RaidZoneClassifierConfig = RAID_ZONE_CLASSIFIER_CONFIG
): RaidZoneClassification => {
  const raidZoneIdSet = new Set<number>(config.raidZoneIds)
  const raidZoneNameSet = toSet(config.raidZoneNames)
  const raidZoneAliasSet = toSet(config.raidZoneAliases)
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
