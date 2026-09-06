import { describe, expect, it } from 'vitest'
import { createEmptyRosterSession } from '../../lib/roster-session-storage'
import { rosterReviewReducer } from '../roster-review-reducer'

const entry = (playerName: string) => ({
  playerName,
  className: null,
  role: 'unknown' as const,
  availability: 'available' as const,
  note: '',
  source: 'manual' as const,
})

describe('rosterReviewReducer', () => {
  it('adds availability entries and ignores duplicate names case-insensitively', () => {
    let state = rosterReviewReducer(createEmptyRosterSession(), { type: 'addAvailability', entries: [entry('Bagge'), entry(' bagge '), entry('Kormath')] })
    expect(state.availability.map((e) => e.playerName)).toEqual(['Bagge', 'Kormath'])
    state = rosterReviewReducer(state, { type: 'addAvailability', entries: [entry('BAGGE')] })
    expect(state.availability).toHaveLength(2)
  })

  it('updates and removes entries, clearing decisions for removed players', () => {
    let state = rosterReviewReducer(createEmptyRosterSession(), { type: 'addAvailability', entries: [entry('Bagge')] })
    const id = state.availability[0].id
    state = rosterReviewReducer(state, { type: 'updateAvailability', id, patch: { availability: 'late', note: 'until 20:30' } })
    state = rosterReviewReducer(state, { type: 'setDecision', playerName: 'Bagge', patch: { decision: 'start' } })
    expect(state.availability[0]).toMatchObject({ availability: 'late', note: 'until 20:30' })
    expect(state.decisions.Bagge.decision).toBe('start')
    state = rosterReviewReducer(state, { type: 'removeAvailability', id })
    expect(state.availability).toHaveLength(0)
    expect(state.decisions.Bagge).toBeUndefined()
  })

  it('applies suggested roles only to unknown roles', () => {
    let state = rosterReviewReducer(createEmptyRosterSession(), { type: 'addAvailability', entries: [entry('Bagge'), { ...entry('Kormath'), role: 'tank' }] })
    state = rosterReviewReducer(state, { type: 'applySuggestedRoles', roles: { bagge: 'ranged', Kormath: 'melee' } })
    expect(state.availability.map((e) => e.role)).toEqual(['ranged', 'tank'])
  })

  it('keeps role targets consistent', () => {
    const state = rosterReviewReducer(createEmptyRosterSession(), { type: 'setRoleTargets', targets: { healers: 5 } })
    expect(state.roleTargets).toEqual({ total: 20, tanks: 2, healers: 5, dps: 13 })
  })

  it('toggles reports and encounters', () => {
    let state = rosterReviewReducer(createEmptyRosterSession(), { type: 'toggleReport', code: 'A' })
    state = rosterReviewReducer(state, { type: 'toggleReport', code: 'B' })
    state = rosterReviewReducer(state, { type: 'toggleReport', code: 'A' })
    state = rosterReviewReducer(state, { type: 'toggleEncounter', encounterId: 7 })
    expect(state.raid.reportCodes).toEqual(['B'])
    expect(state.raid.encounterIds).toEqual([7])
  })

  it('stores decisions with partial patches and comparison notes', () => {
    let state = rosterReviewReducer(createEmptyRosterSession(), { type: 'setDecision', playerName: 'Bagge', patch: { reasonText: 'why' } })
    expect(state.decisions.Bagge).toEqual({ decision: 'notSelected', reasonCategory: null, reasonText: 'why' })
    state = rosterReviewReducer(state, { type: 'addComparisonNote', note: { playerA: 'Bagge', playerB: 'Kormath', text: 'x' } })
    expect(state.comparisonNotes).toHaveLength(1)
    state = rosterReviewReducer(state, { type: 'removeComparisonNote', id: state.comparisonNotes[0].id })
    expect(state.comparisonNotes).toHaveLength(0)
  })
})
