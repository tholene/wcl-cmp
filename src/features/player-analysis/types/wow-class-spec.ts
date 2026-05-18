export type WowRole = 'tank' | 'healer' | 'dps'
export type WowSpecEntry = { specName: string; role: WowRole }

export const WOW_CLASS_SPEC_LIST: Record<string, WowSpecEntry[]> = {
  'Death Knight': [
    { specName: 'Blood', role: 'tank' },
    { specName: 'Frost', role: 'dps' },
    { specName: 'Unholy', role: 'dps' },
  ],
  'Demon Hunter': [
    { specName: 'Havoc', role: 'dps' },
    { specName: 'Vengeance', role: 'tank' },
  ],
  'Druid': [
    { specName: 'Balance', role: 'dps' },
    { specName: 'Feral', role: 'dps' },
    { specName: 'Guardian', role: 'tank' },
    { specName: 'Restoration', role: 'healer' },
  ],
  'Evoker': [
    { specName: 'Devastation', role: 'dps' },
    { specName: 'Preservation', role: 'healer' },
    { specName: 'Augmentation', role: 'dps' },
  ],
  'Hunter': [
    { specName: 'Beast Mastery', role: 'dps' },
    { specName: 'Marksmanship', role: 'dps' },
    { specName: 'Survival', role: 'dps' },
  ],
  'Mage': [
    { specName: 'Arcane', role: 'dps' },
    { specName: 'Fire', role: 'dps' },
    { specName: 'Frost', role: 'dps' },
  ],
  'Monk': [
    { specName: 'Brewmaster', role: 'tank' },
    { specName: 'Windwalker', role: 'dps' },
    { specName: 'Mistweaver', role: 'healer' },
  ],
  'Paladin': [
    { specName: 'Holy', role: 'healer' },
    { specName: 'Protection', role: 'tank' },
    { specName: 'Retribution', role: 'dps' },
  ],
  'Priest': [
    { specName: 'Discipline', role: 'healer' },
    { specName: 'Holy', role: 'healer' },
    { specName: 'Shadow', role: 'dps' },
  ],
  'Rogue': [
    { specName: 'Assassination', role: 'dps' },
    { specName: 'Outlaw', role: 'dps' },
    { specName: 'Subtlety', role: 'dps' },
  ],
  'Shaman': [
    { specName: 'Elemental', role: 'dps' },
    { specName: 'Enhancement', role: 'dps' },
    { specName: 'Restoration', role: 'healer' },
  ],
  'Warlock': [
    { specName: 'Affliction', role: 'dps' },
    { specName: 'Demonology', role: 'dps' },
    { specName: 'Destruction', role: 'dps' },
  ],
  'Warrior': [
    { specName: 'Arms', role: 'dps' },
    { specName: 'Fury', role: 'dps' },
    { specName: 'Protection', role: 'tank' },
  ],
}

export const CLASS_NAMES = Object.keys(WOW_CLASS_SPEC_LIST).sort()

export function getSpecsForClass(className: string): WowSpecEntry[] {
  return WOW_CLASS_SPEC_LIST[className] ?? []
}

export function getRoleForSpec(className: string, specName: string): WowRole | null {
  return WOW_CLASS_SPEC_LIST[className]?.find((s) => s.specName === specName)?.role ?? null
}
