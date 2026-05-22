export type WowClassName =
  | 'Death Knight'
  | 'Demon Hunter'
  | 'Druid'
  | 'Evoker'
  | 'Hunter'
  | 'Mage'
  | 'Monk'
  | 'Paladin'
  | 'Priest'
  | 'Rogue'
  | 'Shaman'
  | 'Warlock'
  | 'Warrior'

// Keyed by lowercase-no-space so "DeathKnight", "Death Knight", "DEATHKNIGHT", etc. all match.
const NORMALIZE_MAP: Record<string, WowClassName> = {
  deathknight: 'Death Knight',
  demonhunter: 'Demon Hunter',
  druid: 'Druid',
  evoker: 'Evoker',
  hunter: 'Hunter',
  mage: 'Mage',
  monk: 'Monk',
  paladin: 'Paladin',
  priest: 'Priest',
  rogue: 'Rogue',
  shaman: 'Shaman',
  warlock: 'Warlock',
  warrior: 'Warrior',
}

// WoW standard class colors (hex).
const CLASS_COLORS: Record<WowClassName, string> = {
  'Death Knight': '#C41E3A',
  'Demon Hunter': '#A330C9',
  Druid:          '#FF7C0A',
  Evoker:         '#33937F',
  Hunter:         '#AAD372',
  Mage:           '#3FC7EB',
  Monk:           '#00FF98',
  Paladin:        '#F48CBA',
  Priest:         '#FFFFFF',
  Rogue:          '#FFF468',
  Shaman:         '#0070DD',
  Warlock:        '#8788EE',
  Warrior:        '#C69B6D',
}

// Lowercase icon key used in the RPGLogs ability CDN path.
const CLASS_ICON_KEYS: Record<WowClassName, string> = {
  'Death Knight': 'classicon_deathknight',
  'Demon Hunter': 'classicon_demonhunter',
  Druid:          'classicon_druid',
  Evoker:         'classicon_evoker',
  Hunter:         'classicon_hunter',
  Mage:           'classicon_mage',
  Monk:           'classicon_monk',
  Paladin:        'classicon_paladin',
  Priest:         'classicon_priest',
  Rogue:          'classicon_rogue',
  Shaman:         'classicon_shaman',
  Warlock:        'classicon_warlock',
  Warrior:        'classicon_warrior',
}

const WCL_ABILITY_ICON_BASE = 'https://assets.rpglogs.com/img/warcraft/abilities'
const FALLBACK_COLOR = '#b5bac1'

/** Normalize any WCL/user-supplied class string to the canonical display name. */
export function normalizeWowClassName(value?: string | null): WowClassName | null {
  if (!value) return null
  // Strip spaces and lowercase → handles "DeathKnight", "Death Knight", "DEATHKNIGHT", etc.
  return NORMALIZE_MAP[value.toLowerCase().replace(/\s+/g, '')] ?? null
}

/** Hex color for the given class string (normalized). Returns neutral gray for unknown classes. */
export function getWowClassColor(value?: string | null): string {
  const name = normalizeWowClassName(value)
  return name ? CLASS_COLORS[name] : FALLBACK_COLOR
}

/** RPGLogs CDN URL for the class icon, or null if the class is unknown. */
export function getWowClassIconUrl(value?: string | null): string | null {
  const name = normalizeWowClassName(value)
  if (!name) return null
  return `${WCL_ABILITY_ICON_BASE}/${CLASS_ICON_KEYS[name]}.jpg`
}
