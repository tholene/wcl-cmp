import { describe, expect, it } from 'vitest'
import { validateRosterEvidenceRequest } from '../roster-review.service'

describe('validateRosterEvidenceRequest', () => {
  it('normalises codes, dedupes player names case-insensitively and accepts filters', () => {
    const result = validateRosterEvidenceRequest({
      reportCodes: [' abc ', 'abc', 'def'],
      playerNames: ['Bagge', 'bagge ', 'Kormath'],
      difficulty: 4,
      encounterIds: [3001, 3001, -1, 2.5],
    })
    expect(result).toEqual({
      ok: true,
      normalized: { reportCodes: ['abc', 'def'], difficulty: 4, encounterIds: [3001], playerNames: ['Bagge', 'Kormath'] },
    })
  })

  it('rejects missing reports or players', () => {
    expect(validateRosterEvidenceRequest({ playerNames: ['A'] })).toMatchObject({ ok: false })
    expect(validateRosterEvidenceRequest({ reportCodes: ['x'], playerNames: [] })).toMatchObject({ ok: false })
  })

  it('rejects invalid difficulty', () => {
    expect(validateRosterEvidenceRequest({ reportCodes: ['x'], playerNames: ['A'], difficulty: 'heroic' })).toMatchObject({ ok: false })
    expect(validateRosterEvidenceRequest({ reportCodes: ['x'], playerNames: ['A'], difficulty: null })).toMatchObject({ ok: true, normalized: { difficulty: null } })
  })

  it('caps report and player counts', () => {
    expect(validateRosterEvidenceRequest({ reportCodes: ['1', '2', '3', '4', '5', '6', '7'], playerNames: ['A'] })).toMatchObject({ ok: false })
  })
})
