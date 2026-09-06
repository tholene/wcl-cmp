import { getRoleForSpec } from '@/features/player-analysis/types/wow-class-spec'
import { normalizeWowClassName } from '@/lib/wow-class'
import type { RosterRaidRole } from '../types/roster-review.types'

// Melee DPS specs; every other DPS spec in the shared class/spec list is ranged.
const MELEE_DPS_SPECS = new Set([
  'death knight:frost',
  'death knight:unholy',
  'demon hunter:havoc',
  'druid:feral',
  'hunter:survival',
  'monk:windwalker',
  'paladin:retribution',
  'rogue:assassination',
  'rogue:outlaw',
  'rogue:subtlety',
  'shaman:enhancement',
  'warrior:arms',
  'warrior:fury',
])

const key = (className: string, specName: string): string => `${className.toLowerCase()}:${specName.toLowerCase()}`

/** Suggest the officer-facing raid role from a WCL class/spec pair. Unknown stays unknown. */
export const suggestRaidRole = (className: string | null | undefined, specName: string | null | undefined): RosterRaidRole => {
  // WCL rankings return class names without spaces ("DeathKnight"); normalise before lookup.
  const canonicalClass = normalizeWowClassName(className)
  if (!canonicalClass || !specName) return 'unknown'
  const role = getRoleForSpec(canonicalClass, specName.trim())
  if (role === 'tank') return 'tank'
  if (role === 'healer') return 'healer'
  if (role === 'dps') return MELEE_DPS_SPECS.has(key(canonicalClass, specName.trim())) ? 'melee' : 'ranged'
  return 'unknown'
}

export const RAID_ROLE_LABELS: Record<RosterRaidRole, string> = {
  tank: 'Tank',
  healer: 'Healer',
  melee: 'Melee',
  ranged: 'Ranged',
  unknown: 'Unknown',
}

export const RAID_ROLE_ORDER: RosterRaidRole[] = ['tank', 'healer', 'melee', 'ranged', 'unknown']
