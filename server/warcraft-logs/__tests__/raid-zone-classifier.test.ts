import { describe, expect, it } from 'vitest'
import { classifyRaidZone } from '../raid-zone-classifier'

describe('classifyRaidZone', () => {
  it('classifies zone id 1056 (SSC / TK) as raid', () => {
    const result = classifyRaidZone({ zoneId: 1056, zoneName: 'SSC / TK' })
    expect(result.isRaid).toBe(true)
  })

  it('classifies zone id 1048 (Gruul / Magtheridon) as raid', () => {
    const result = classifyRaidZone({ zoneId: 1048, zoneName: 'Gruul / Magtheridon' })
    expect(result.isRaid).toBe(true)
  })

  it('classifies name-only SSC / TK as raid', () => {
    const result = classifyRaidZone({ zoneName: 'SSC / TK' })
    expect(result.isRaid).toBe(true)
  })

  it('classifies name-only Gruul / Magtheridon as raid', () => {
    const result = classifyRaidZone({ zoneName: 'Gruul / Magtheridon' })
    expect(result.isRaid).toBe(true)
  })

  it('keeps obvious dungeon-like zone as non-raid', () => {
    const result = classifyRaidZone({ zoneName: 'The Slave Pens (Heroic)' })
    expect(result.isRaid).toBe(false)
  })

  it('keeps unknown zone as non-raid', () => {
    const result = classifyRaidZone({ zoneName: 'Completely Unknown Test Zone' })
    expect(result.isRaid).toBe(false)
  })
})
