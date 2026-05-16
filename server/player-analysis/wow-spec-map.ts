export type WowRole = 'tank' | 'healer' | 'dps'
export type WowSpecInfo = { className: string; specName: string; role: WowRole }

export const WOW_SPEC_MAP: Record<number, WowSpecInfo> = {
  // Death Knight
  250: { className: 'Death Knight', specName: 'Blood', role: 'tank' },
  251: { className: 'Death Knight', specName: 'Frost', role: 'dps' },
  252: { className: 'Death Knight', specName: 'Unholy', role: 'dps' },
  // Demon Hunter
  577: { className: 'Demon Hunter', specName: 'Havoc', role: 'dps' },
  581: { className: 'Demon Hunter', specName: 'Vengeance', role: 'tank' },
  // Druid
  102: { className: 'Druid', specName: 'Balance', role: 'dps' },
  103: { className: 'Druid', specName: 'Feral', role: 'dps' },
  104: { className: 'Druid', specName: 'Guardian', role: 'tank' },
  105: { className: 'Druid', specName: 'Restoration', role: 'healer' },
  // Evoker
  1467: { className: 'Evoker', specName: 'Devastation', role: 'dps' },
  1468: { className: 'Evoker', specName: 'Preservation', role: 'healer' },
  1473: { className: 'Evoker', specName: 'Augmentation', role: 'dps' },
  // Hunter
  253: { className: 'Hunter', specName: 'Beast Mastery', role: 'dps' },
  254: { className: 'Hunter', specName: 'Marksmanship', role: 'dps' },
  255: { className: 'Hunter', specName: 'Survival', role: 'dps' },
  // Mage
  62: { className: 'Mage', specName: 'Arcane', role: 'dps' },
  63: { className: 'Mage', specName: 'Fire', role: 'dps' },
  64: { className: 'Mage', specName: 'Frost', role: 'dps' },
  // Monk
  268: { className: 'Monk', specName: 'Brewmaster', role: 'tank' },
  269: { className: 'Monk', specName: 'Windwalker', role: 'dps' },
  270: { className: 'Monk', specName: 'Mistweaver', role: 'healer' },
  // Paladin
  65: { className: 'Paladin', specName: 'Holy', role: 'healer' },
  66: { className: 'Paladin', specName: 'Protection', role: 'tank' },
  70: { className: 'Paladin', specName: 'Retribution', role: 'dps' },
  // Priest
  256: { className: 'Priest', specName: 'Discipline', role: 'healer' },
  257: { className: 'Priest', specName: 'Holy', role: 'healer' },
  258: { className: 'Priest', specName: 'Shadow', role: 'dps' },
  // Rogue
  259: { className: 'Rogue', specName: 'Assassination', role: 'dps' },
  260: { className: 'Rogue', specName: 'Outlaw', role: 'dps' },
  261: { className: 'Rogue', specName: 'Subtlety', role: 'dps' },
  // Shaman
  262: { className: 'Shaman', specName: 'Elemental', role: 'dps' },
  263: { className: 'Shaman', specName: 'Enhancement', role: 'dps' },
  264: { className: 'Shaman', specName: 'Restoration', role: 'healer' },
  // Warlock
  265: { className: 'Warlock', specName: 'Affliction', role: 'dps' },
  266: { className: 'Warlock', specName: 'Demonology', role: 'dps' },
  267: { className: 'Warlock', specName: 'Destruction', role: 'dps' },
  // Warrior
  71: { className: 'Warrior', specName: 'Arms', role: 'dps' },
  72: { className: 'Warrior', specName: 'Fury', role: 'dps' },
  73: { className: 'Warrior', specName: 'Protection', role: 'tank' },
}
