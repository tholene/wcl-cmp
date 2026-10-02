import type { MechanicAuditFormState } from '../hooks/mechanic-audit-form-reducer'
import type { MechanicAuditMechanic, MechanicAuditPhaseOneBoundary, MechanicAuditRequest } from '../types/mechanic-audit.types'

export const parseAbilityIdsText = (text: string): number[] =>
  text
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part))
    .filter((value) => Number.isInteger(value) && value > 0)

export const parseReportCodesText = (text: string): string[] =>
  text
    .split(/[\s,]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

const buildScope = (form: MechanicAuditFormState): MechanicAuditRequest['scope'] => {
  if (form.scopeMode === 'manualReports') {
    return { mode: 'manualReports', reportCodes: parseReportCodesText(form.reportCodesText) }
  }
  return {
    mode: 'dateRange',
    since: form.since ? new Date(form.since).getTime() : 0,
    until: form.until ? new Date(form.until).getTime() : 0,
  }
}

const buildMechanics = (form: MechanicAuditFormState): MechanicAuditMechanic[] =>
  form.mechanics.map((entry) => ({
    key: entry.key.trim(),
    label: entry.label.trim(),
    abilityIds: parseAbilityIdsText(entry.abilityIdsText),
    ...(entry.dedupeWindowMsText.trim() ? { dedupeWindowMs: Number(entry.dedupeWindowMsText) } : {}),
    ...(entry.occurrenceAbilityIdsText.trim() ? { occurrenceAbilityIds: parseAbilityIdsText(entry.occurrenceAbilityIdsText) } : {}),
    ...(entry.occurrenceEventType ? { occurrenceEventType: entry.occurrenceEventType } : {}),
  }))

const buildPhaseOneBoundary = (form: MechanicAuditFormState): MechanicAuditPhaseOneBoundary => {
  switch (form.phaseOneBoundaryMode) {
    case 'markerAbility':
      return { mode: 'markerAbility', abilityIds: parseAbilityIdsText(form.markerAbilityIdsText) }
    case 'fightRelativeTimestamp':
      return { mode: 'fightRelativeTimestamp', endTimeMs: Number(form.fightRelativeEndTimeMs) || 0 }
    case 'phaseTransition':
    default:
      return {
        mode: 'phaseTransition',
        phase: Number(form.phaseTransitionPhase) || 0,
        noTransitionFallback:
          form.noTransitionFallbackMode === 'markerAbilityThenFightEndForWipes'
            ? { mode: 'markerAbilityThenFightEndForWipes', abilityIds: parseAbilityIdsText(form.noTransitionFallbackAbilityIdsText) }
            : { mode: form.noTransitionFallbackMode },
      }
  }
}

export const buildMechanicAuditRequest = (form: MechanicAuditFormState): MechanicAuditRequest => ({
  scope: buildScope(form),
  encounter: {
    encounterId: Number(form.encounterId) || 0,
    difficulty: Number(form.difficulty) || 0,
    ...(form.encounterName.trim() ? { encounterName: form.encounterName.trim() } : {}),
  },
  mechanics: buildMechanics(form),
  phaseOneBoundary: buildPhaseOneBoundary(form),
  timezone: form.timezone.trim() || undefined,
  thresholds: form.thresholds,
})

export const validateMechanicAuditForm = (form: MechanicAuditFormState): string[] => {
  const errors: string[] = []

  if (form.scopeMode === 'dateRange') {
    if (!form.since || !form.until) {
      errors.push('Select both a start and end date for the date range.')
    } else if (new Date(form.since).getTime() >= new Date(form.until).getTime()) {
      errors.push('The date range start must be before the end.')
    }
  } else if (parseReportCodesText(form.reportCodesText).length === 0) {
    errors.push('Enter at least one report code.')
  }

  if (!Number(form.encounterId)) {
    errors.push("A verified L'ura encounter ID is required.")
  }
  if (!Number(form.difficulty)) {
    errors.push('A difficulty value is required (5 = Mythic).')
  }

  if (form.mechanics.length === 0) {
    errors.push('At least one mechanic (e.g. Glaives, Beams) is required.')
  } else {
    for (const mechanic of form.mechanics) {
      if (!mechanic.key.trim() || !mechanic.label.trim()) {
        errors.push('Each mechanic requires a key and a label.')
      }
      if (parseAbilityIdsText(mechanic.abilityIdsText).length === 0) {
        errors.push(`Mechanic "${mechanic.label || mechanic.key}" requires at least one verified ability ID.`)
      }
      if (
        (mechanic.occurrenceAbilityIdsText.trim() || mechanic.occurrenceEventType) &&
        (parseAbilityIdsText(mechanic.occurrenceAbilityIdsText).length === 0 || !mechanic.occurrenceEventType)
      ) {
        errors.push(
          `Mechanic "${mechanic.label || mechanic.key}" needs both a verified occurrence ability ID and an occurrence event type, or neither.`
        )
      }
    }
  }

  if (form.phaseOneBoundaryMode === 'markerAbility' && parseAbilityIdsText(form.markerAbilityIdsText).length === 0) {
    errors.push('Marker-ability boundary requires at least one verified ability ID.')
  }
  if (form.phaseOneBoundaryMode === 'fightRelativeTimestamp' && !Number(form.fightRelativeEndTimeMs)) {
    errors.push('Fight-relative timestamp boundary requires a positive end time in ms.')
  }
  if (form.phaseOneBoundaryMode === 'phaseTransition') {
    if (!Number(form.phaseTransitionPhase)) {
      errors.push('Phase-transition boundary requires a positive phase number.')
    }
    if (
      form.noTransitionFallbackMode === 'markerAbilityThenFightEndForWipes' &&
      parseAbilityIdsText(form.noTransitionFallbackAbilityIdsText).length === 0
    ) {
      errors.push('The marker-ability fallback requires at least one verified marker ability ID.')
    }
  }

  return errors
}
