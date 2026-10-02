import type { MechanicAuditRequest } from './mechanic-audit.types'

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value > 0

export const validateMechanicAuditRequest = (request: MechanicAuditRequest): string[] => {
  const errors: string[] = []

  if (!request.scope) {
    errors.push('A scope (date range or manual report codes) is required.')
  } else if (request.scope.mode === 'dateRange') {
    if (!Number.isFinite(request.scope.since) || !Number.isFinite(request.scope.until)) {
      errors.push('Date range scope requires numeric since/until timestamps.')
    } else if (request.scope.since >= request.scope.until) {
      errors.push('Date range "since" must be before "until".')
    }
  } else if (request.scope.mode === 'manualReports') {
    if (!Array.isArray(request.scope.reportCodes) || request.scope.reportCodes.length === 0) {
      errors.push('Manual report scope requires at least one report code.')
    }
  } else {
    errors.push('Scope mode must be "dateRange" or "manualReports".')
  }

  if (!isPositiveInteger(request.encounter?.encounterId)) {
    errors.push('A verified L\'ura encounter ID is required. It cannot be guessed or defaulted.')
  }
  if (!isPositiveInteger(request.encounter?.difficulty)) {
    errors.push('A difficulty value is required (5 = Mythic).')
  }

  if (!Array.isArray(request.mechanics) || request.mechanics.length === 0) {
    errors.push('At least one mechanic (e.g. Glaives, Beams) is required.')
  } else {
    for (const mechanic of request.mechanics) {
      if (!mechanic.key?.trim() || !mechanic.label?.trim()) {
        errors.push('Each mechanic requires a key and a label.')
      }
      if (!Array.isArray(mechanic.abilityIds) || mechanic.abilityIds.length === 0 || !mechanic.abilityIds.every(isPositiveInteger)) {
        errors.push(`Mechanic "${mechanic.label ?? mechanic.key ?? 'unknown'}" requires at least one verified ability ID.`)
      }
      if (mechanic.dedupeWindowMs !== undefined && (!Number.isFinite(mechanic.dedupeWindowMs) || mechanic.dedupeWindowMs < 0)) {
        errors.push(`Mechanic "${mechanic.label ?? mechanic.key}" has an invalid dedupeWindowMs.`)
      }
      if (mechanic.occurrenceAbilityIds !== undefined || mechanic.occurrenceEventType !== undefined) {
        if (
          !Array.isArray(mechanic.occurrenceAbilityIds) ||
          mechanic.occurrenceAbilityIds.length === 0 ||
          !mechanic.occurrenceAbilityIds.every(isPositiveInteger)
        ) {
          errors.push(
            `Mechanic "${mechanic.label ?? mechanic.key}" sets occurrenceEventType/occurrenceAbilityIds but needs at least one verified occurrence ability ID.`
          )
        }
        if (!mechanic.occurrenceEventType || !['Casts', 'Debuffs', 'Buffs'].includes(mechanic.occurrenceEventType)) {
          errors.push(
            `Mechanic "${mechanic.label ?? mechanic.key}" requires occurrenceEventType ("Casts", "Debuffs", or "Buffs") when occurrenceAbilityIds is set.`
          )
        }
      }
    }
    const duplicateKeys = request.mechanics
      .map((m) => m.key)
      .filter((key, index, all) => all.indexOf(key) !== index)
    if (duplicateKeys.length > 0) {
      errors.push(`Duplicate mechanic keys are not allowed: ${[...new Set(duplicateKeys)].join(', ')}`)
    }
  }

  if (!request.phaseOneBoundary) {
    errors.push('A Phase 1 boundary strategy is required.')
  } else {
    switch (request.phaseOneBoundary.mode) {
      case 'phaseTransition':
        if (!isPositiveInteger(request.phaseOneBoundary.phase)) {
          errors.push('Phase-transition boundary requires a positive integer phase number.')
        }
        if (request.phaseOneBoundary.noTransitionFallback) {
          const fallback = request.phaseOneBoundary.noTransitionFallback
          if (!['exclude', 'fightEndForWipes', 'markerAbilityThenFightEndForWipes'].includes(fallback.mode)) {
            errors.push('noTransitionFallback.mode must be "exclude", "fightEndForWipes", or "markerAbilityThenFightEndForWipes".')
          } else if (fallback.mode === 'markerAbilityThenFightEndForWipes') {
            if (!Array.isArray(fallback.abilityIds) || fallback.abilityIds.length === 0 || !fallback.abilityIds.every(isPositiveInteger)) {
              errors.push('noTransitionFallback "markerAbilityThenFightEndForWipes" requires at least one verified marker ability ID.')
            }
          }
        }
        break
      case 'markerAbility':
        if (
          !Array.isArray(request.phaseOneBoundary.abilityIds) ||
          request.phaseOneBoundary.abilityIds.length === 0 ||
          !request.phaseOneBoundary.abilityIds.every(isPositiveInteger)
        ) {
          errors.push('Marker-ability boundary requires at least one verified ability ID.')
        }
        break
      case 'fightRelativeTimestamp':
        if (!Number.isFinite(request.phaseOneBoundary.endTimeMs) || request.phaseOneBoundary.endTimeMs <= 0) {
          errors.push('Fight-relative timestamp boundary requires a positive endTimeMs.')
        }
        break
      default:
        errors.push('Phase 1 boundary mode must be "phaseTransition", "markerAbility", or "fightRelativeTimestamp".')
    }
  }

  const thresholds = request.thresholds
  if (thresholds) {
    if (thresholds.minimumEligiblePulls !== undefined && thresholds.minimumEligiblePulls < 0) {
      errors.push('minimumEligiblePulls cannot be negative.')
    }
    if (thresholds.minimumRaidNightsWithFailure !== undefined && thresholds.minimumRaidNightsWithFailure < 0) {
      errors.push('minimumRaidNightsWithFailure cannot be negative.')
    }
    if (thresholds.guildAverageMultiplier !== undefined && thresholds.guildAverageMultiplier <= 0) {
      errors.push('guildAverageMultiplier must be positive.')
    }
    if (thresholds.minimumAbsoluteRateDelta !== undefined && thresholds.minimumAbsoluteRateDelta < 0) {
      errors.push('minimumAbsoluteRateDelta cannot be negative.')
    }
  }

  return errors
}

export const assertValidMechanicAuditRequest = (request: MechanicAuditRequest): void => {
  const errors = validateMechanicAuditRequest(request)
  if (errors.length > 0) {
    throw new Error(errors.join(' '))
  }
}
