import type { PlayerAnalysisTimeframePreset } from '../types/player-analysis.types'

export type ScopeState = {
  playerName: string
  timeframePreset: PlayerAnalysisTimeframePreset
  selectedReports: string[]
  includeKills: boolean
  includeWipes: boolean
  includeTrash: boolean
  onlyPlayerPresent: boolean
}

export type ScopeAction =
  | { type: 'setPlayerName'; value: string }
  | { type: 'setTimeframePreset'; value: PlayerAnalysisTimeframePreset }
  | { type: 'setSelectedReports'; value: string[] }
  | { type: 'setIncludeKills'; value: boolean }
  | { type: 'setIncludeWipes'; value: boolean }
  | { type: 'setIncludeTrash'; value: boolean }
  | { type: 'setOnlyPlayerPresent'; value: boolean }
  | { type: 'resetScope' }

export const INITIAL_SCOPE_STATE: ScopeState = {
  playerName: '',
  timeframePreset: 'last30Days',
  selectedReports: [],
  includeKills: true,
  includeWipes: false,
  includeTrash: false,
  onlyPlayerPresent: true,
}

export const scopeReducer = (state: ScopeState, action: ScopeAction): ScopeState => {
  switch (action.type) {
    case 'setPlayerName':       return { ...state, playerName: action.value }
    case 'setTimeframePreset':  return { ...state, timeframePreset: action.value }
    case 'setSelectedReports':  return { ...state, selectedReports: action.value }
    case 'setIncludeKills':     return { ...state, includeKills: action.value }
    case 'setIncludeWipes':     return { ...state, includeWipes: action.value }
    case 'setIncludeTrash':     return { ...state, includeTrash: action.value }
    case 'setOnlyPlayerPresent': return { ...state, onlyPlayerPresent: action.value }
    case 'resetScope':          return INITIAL_SCOPE_STATE
  }
}
