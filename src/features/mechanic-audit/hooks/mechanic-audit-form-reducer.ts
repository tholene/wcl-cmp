import {
  MECHANIC_AUDIT_DEFAULT_THRESHOLDS,
  MECHANIC_AUDIT_DEFAULT_TIMEZONE,
  type MechanicAuditNoTransitionFallback,
  type MechanicAuditOccurrenceEventType,
  type MechanicAuditPhaseOneBoundary,
  type MechanicAuditThresholds,
} from '../types/mechanic-audit.types'

export type MechanicAuditMechanicFormEntry = {
  key: string
  label: string
  abilityIdsText: string
  dedupeWindowMsText: string
  occurrenceAbilityIdsText: string
  occurrenceEventType: MechanicAuditOccurrenceEventType | ''
}

export type MechanicAuditFormState = {
  scopeMode: 'dateRange' | 'manualReports'
  since: string
  until: string
  reportCodesText: string
  encounterId: string
  encounterName: string
  difficulty: string
  timezone: string
  mechanics: MechanicAuditMechanicFormEntry[]
  phaseOneBoundaryMode: MechanicAuditPhaseOneBoundary['mode']
  phaseTransitionPhase: string
  markerAbilityIdsText: string
  fightRelativeEndTimeMs: string
  noTransitionFallbackMode: MechanicAuditNoTransitionFallback['mode']
  noTransitionFallbackAbilityIdsText: string
  thresholds: MechanicAuditThresholds
}

export const DEFAULT_MECHANIC_ENTRIES: MechanicAuditMechanicFormEntry[] = [
  { key: 'glaives', label: 'Glaives', abilityIdsText: '1254076', dedupeWindowMsText: '', occurrenceAbilityIdsText: '', occurrenceEventType: '' },
  { key: 'beams', label: 'Beams', abilityIdsText: '1282469', dedupeWindowMsText: '', occurrenceAbilityIdsText: '', occurrenceEventType: '' },
]

export const INITIAL_MECHANIC_AUDIT_FORM_STATE: MechanicAuditFormState = {
  scopeMode: 'dateRange',
  since: '',
  until: '',
  reportCodesText: '',
  encounterId: '',
  encounterName: '',
  difficulty: '5',
  timezone: MECHANIC_AUDIT_DEFAULT_TIMEZONE,
  mechanics: DEFAULT_MECHANIC_ENTRIES,
  phaseOneBoundaryMode: 'phaseTransition',
  phaseTransitionPhase: '2',
  markerAbilityIdsText: '',
  fightRelativeEndTimeMs: '',
  noTransitionFallbackMode: 'exclude',
  noTransitionFallbackAbilityIdsText: '',
  thresholds: { ...MECHANIC_AUDIT_DEFAULT_THRESHOLDS },
}

export type MechanicAuditFormAction =
  | { type: 'setScopeMode'; value: MechanicAuditFormState['scopeMode'] }
  | { type: 'setSince'; value: string }
  | { type: 'setUntil'; value: string }
  | { type: 'setReportCodesText'; value: string }
  | { type: 'setEncounterId'; value: string }
  | { type: 'setEncounterName'; value: string }
  | { type: 'setDifficulty'; value: string }
  | { type: 'setTimezone'; value: string }
  | { type: 'setMechanics'; value: MechanicAuditMechanicFormEntry[] }
  | { type: 'setPhaseOneBoundaryMode'; value: MechanicAuditFormState['phaseOneBoundaryMode'] }
  | { type: 'setPhaseTransitionPhase'; value: string }
  | { type: 'setMarkerAbilityIdsText'; value: string }
  | { type: 'setFightRelativeEndTimeMs'; value: string }
  | { type: 'setNoTransitionFallbackMode'; value: MechanicAuditFormState['noTransitionFallbackMode'] }
  | { type: 'setNoTransitionFallbackAbilityIdsText'; value: string }
  | { type: 'setThresholds'; value: Partial<MechanicAuditThresholds> }

export const mechanicAuditFormReducer = (
  state: MechanicAuditFormState,
  action: MechanicAuditFormAction
): MechanicAuditFormState => {
  switch (action.type) {
    case 'setScopeMode':
      return { ...state, scopeMode: action.value }
    case 'setSince':
      return { ...state, since: action.value }
    case 'setUntil':
      return { ...state, until: action.value }
    case 'setReportCodesText':
      return { ...state, reportCodesText: action.value }
    case 'setEncounterId':
      return { ...state, encounterId: action.value }
    case 'setEncounterName':
      return { ...state, encounterName: action.value }
    case 'setDifficulty':
      return { ...state, difficulty: action.value }
    case 'setTimezone':
      return { ...state, timezone: action.value }
    case 'setMechanics':
      return { ...state, mechanics: action.value }
    case 'setPhaseOneBoundaryMode':
      return { ...state, phaseOneBoundaryMode: action.value }
    case 'setPhaseTransitionPhase':
      return { ...state, phaseTransitionPhase: action.value }
    case 'setMarkerAbilityIdsText':
      return { ...state, markerAbilityIdsText: action.value }
    case 'setFightRelativeEndTimeMs':
      return { ...state, fightRelativeEndTimeMs: action.value }
    case 'setNoTransitionFallbackMode':
      return { ...state, noTransitionFallbackMode: action.value }
    case 'setNoTransitionFallbackAbilityIdsText':
      return { ...state, noTransitionFallbackAbilityIdsText: action.value }
    case 'setThresholds':
      return { ...state, thresholds: { ...state.thresholds, ...action.value } }
    default:
      return state
  }
}
