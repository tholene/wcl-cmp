import { beforeEach, describe, expect, it } from 'vitest'
import {
  ROSTER_SESSION_STORAGE_KEY,
  createEmptyRosterSession,
  loadRosterSession,
  normalizeRosterSession,
  saveRosterSession,
} from '../roster-session-storage'

describe('roster session storage', () => {
  beforeEach(() => window.localStorage.clear())

  it('round-trips a session through localStorage', () => {
    const session = { ...createEmptyRosterSession(), raid: { targetRaidLabel: 'Wed', reportCodes: ['A'], difficulty: 4, encounterIds: [1] } }
    saveRosterSession(session)
    expect(loadRosterSession().raid).toEqual(session.raid)
    expect(window.localStorage.getItem(ROSTER_SESSION_STORAGE_KEY)).not.toBeNull()
  })

  it('returns an empty session for garbage or wrong versions', () => {
    window.localStorage.setItem(ROSTER_SESSION_STORAGE_KEY, '{not json')
    expect(loadRosterSession()).toEqual(createEmptyRosterSession())
    expect(normalizeRosterSession({ version: 2 })).toEqual(createEmptyRosterSession())
  })

  it('sanitises invalid enums and recomputes derived dps target', () => {
    const normalized = normalizeRosterSession({
      version: 1,
      step: 9,
      roleTargets: { total: 20, tanks: 2, healers: 5, dps: 99 },
      availability: [
        { playerName: 'Bagge', role: 'wizard', availability: 'maybe', note: 1 },
        { playerName: '' },
      ],
      decisions: { Bagge: { decision: 'benchy', reasonCategory: 'nope', reasonText: 'x' } },
    })
    expect(normalized.step).toBe(0)
    expect(normalized.roleTargets).toEqual({ total: 20, tanks: 2, healers: 5, dps: 13 })
    expect(normalized.availability).toHaveLength(1)
    expect(normalized.availability[0]).toMatchObject({ playerName: 'Bagge', role: 'unknown', availability: 'available', note: '' })
    expect(normalized.decisions.Bagge).toEqual({ decision: 'notSelected', reasonCategory: 'other', reasonText: 'x' })
  })
})
