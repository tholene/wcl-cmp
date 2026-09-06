import { describe, expect, it } from 'vitest'
import { makeAvailabilityEntry } from '@/test/factories/roster-review.factory'
import { summarizeRosterCounts } from '../roster-counts'

describe('summarizeRosterCounts', () => {
  it('counts decisions by role and reports target differences as notes', () => {
    const availability = [
      makeAvailabilityEntry({ playerName: 'T1', role: 'tank' }),
      makeAvailabilityEntry({ playerName: 'H1', role: 'healer' }),
      makeAvailabilityEntry({ playerName: 'M1', role: 'melee' }),
      makeAvailabilityEntry({ playerName: 'R1', role: 'ranged' }),
      makeAvailabilityEntry({ playerName: 'U1', role: 'unknown' }),
    ]
    const decisions = {
      T1: { decision: 'start' as const, reasonCategory: null, reasonText: '' },
      H1: { decision: 'flex' as const, reasonCategory: null, reasonText: '' },
      M1: { decision: 'start' as const, reasonCategory: null, reasonText: '' },
      U1: { decision: 'start' as const, reasonCategory: null, reasonText: '' },
    }
    const summary = summarizeRosterCounts(availability, decisions, { total: 20, tanks: 2, healers: 4, dps: 14 })
    expect(summary.startTotal).toBe(3)
    expect(summary.flexTotal).toBe(1)
    expect(summary.tanksStarting).toBe(1)
    expect(summary.dpsStarting).toBe(1)
    expect(summary.unknownRoleStarting).toBe(1)
    expect(summary.notes).toEqual([
      '3 starting vs target 20 (under by 17).',
      '1 tank(s) starting vs target 2.',
      '0 healer(s) starting vs target 4.',
      '1 DPS starting vs target 14.',
      '1 starting player(s) have no raid role set.',
    ])
  })
})
