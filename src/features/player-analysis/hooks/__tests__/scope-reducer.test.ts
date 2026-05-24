import { describe, it, expect } from 'vitest'
import { scopeReducer, INITIAL_SCOPE_STATE } from '../scope-reducer'

describe('scopeReducer', () => {
  it('initial state matches current defaults', () => {
    expect(INITIAL_SCOPE_STATE).toEqual({
      playerName: '',
      timeframePreset: 'last30Days',
      selectedReports: [],
      includeKills: true,
      includeWipes: false,
      includeTrash: false,
      onlyPlayerPresent: true,
    })
  })

  it('setIncludeKills updates only that field', () => {
    const next = scopeReducer(INITIAL_SCOPE_STATE, { type: 'setIncludeKills', value: false })
    expect(next.includeKills).toBe(false)
    expect(next).toMatchObject({ ...INITIAL_SCOPE_STATE, includeKills: false })
  })

  it('setPlayerName updates playerName', () => {
    const next = scopeReducer(INITIAL_SCOPE_STATE, { type: 'setPlayerName', value: 'Arthas' })
    expect(next.playerName).toBe('Arthas')
    expect(next.includeKills).toBe(INITIAL_SCOPE_STATE.includeKills)
  })

  it('resetScope returns INITIAL_SCOPE_STATE', () => {
    const modified = scopeReducer(INITIAL_SCOPE_STATE, { type: 'setPlayerName', value: 'Arthas' })
    const reset = scopeReducer(modified, { type: 'resetScope' })
    expect(reset).toEqual(INITIAL_SCOPE_STATE)
  })
})
