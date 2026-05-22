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

// Keyed by "${normalizedClass}:${normalizedSpec}" (lowercase, no spaces).
const SPEC_ICON_KEYS: Record<string, string> = {
  'deathknight:blood':       'spec_deathknight_blood',
  'deathknight:frost':       'spec_deathknight_frost',
  'deathknight:unholy':      'spec_deathknight_unholy',
  'demonhunter:havoc':       'spec_demonhunter_havoc',
  'demonhunter:vengeance':   'spec_demonhunter_vengeance',
  'druid:balance':           'spec_druid_balance',
  'druid:feral':             'spec_druid_feral',
  'druid:guardian':          'spec_druid_guardian',
  'druid:restoration':       'spec_druid_restoration',
  'evoker:devastation':      'spec_evoker_devastation',
  'evoker:preservation':     'spec_evoker_preservation',
  'evoker:augmentation':     'spec_evoker_augmentation',
  'hunter:beastmastery':     'spec_hunter_beastmastery',
  'hunter:marksmanship':     'spec_hunter_marksmanship',
  'hunter:survival':         'spec_hunter_survival',
  'mage:arcane':             'spec_mage_arcane',
  'mage:fire':               'spec_mage_fire',
  'mage:frost':              'spec_mage_frost',
  'monk:brewmaster':         'spec_monk_brewmaster',
  'monk:mistweaver':         'spec_monk_mistweaver',
  'monk:windwalker':         'spec_monk_windwalker',
  'paladin:holy':            'spec_paladin_holy',
  'paladin:protection':      'spec_paladin_protection',
  'paladin:retribution':     'spec_paladin_retribution',
  'priest:discipline':       'spec_priest_discipline',
  'priest:holy':             'spec_priest_holy',
  'priest:shadow':           'spec_priest_shadow',
  'rogue:assassination':     'spec_rogue_assassination',
  'rogue:outlaw':            'spec_rogue_outlaw',
  'rogue:subtlety':          'spec_rogue_subtlety',
  'shaman:elemental':        'spec_shaman_elemental',
  'shaman:enhancement':      'spec_shaman_enhancement',
  'shaman:restoration':      'spec_shaman_restoration',
  'warlock:affliction':      'spec_warlock_affliction',
  'warlock:demonology':      'spec_warlock_demonology',
  'warlock:destruction':     'spec_warlock_destruction',
  'warrior:arms':            'spec_warrior_arms',
  'warrior:fury':            'spec_warrior_fury',
  'warrior:protection':      'spec_warrior_protection',
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

/** RPGLogs CDN URL for the spec icon, or null if the class+spec combination is unknown. */
export function getWowSpecIconUrl(className?: string | null, specName?: string | null): string | null {
  if (!className || !specName) return null
  const normalizedClass = className.toLowerCase().replace(/\s+/g, '')
  const normalizedSpec = specName.toLowerCase().replace(/\s+/g, '')
  const key = SPEC_ICON_KEYS[`${normalizedClass}:${normalizedSpec}`]
  if (!key) return null
  return `${WCL_ABILITY_ICON_BASE}/${key}.jpg`
}
