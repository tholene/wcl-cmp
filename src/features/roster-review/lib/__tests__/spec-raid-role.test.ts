import { describe, expect, it } from 'vitest'
import { suggestRaidRole } from '../spec-raid-role'

describe('suggestRaidRole', () => {
  it('maps tanks, healers, melee and ranged', () => {
    expect(suggestRaidRole('Warrior', 'Protection')).toBe('tank')
    expect(suggestRaidRole('Priest', 'Holy')).toBe('healer')
    expect(suggestRaidRole('Rogue', 'Outlaw')).toBe('melee')
    expect(suggestRaidRole('Mage', 'Fire')).toBe('ranged')
    expect(suggestRaidRole('Hunter', 'Survival')).toBe('melee')
    expect(suggestRaidRole('Hunter', 'Beast Mastery')).toBe('ranged')
  })

  it('accepts WCL class spellings without spaces', () => {
    expect(suggestRaidRole('DeathKnight', 'Unholy')).toBe('melee')
    expect(suggestRaidRole('DemonHunter', 'Vengeance')).toBe('tank')
    expect(suggestRaidRole('deathknight', 'Blood')).toBe('tank')
  })

  it('keeps unknown pairs unknown', () => {
    expect(suggestRaidRole(null, 'Fire')).toBe('unknown')
    expect(suggestRaidRole('Mage', null)).toBe('unknown')
    expect(suggestRaidRole('Mage', 'Holy')).toBe('unknown')
  })
})
