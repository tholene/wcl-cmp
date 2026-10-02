import { useReducer, useState } from 'react'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import { useMechanicAuditExportJob } from './use-mechanic-audit-export-job'
import { useMechanicAuditPreview } from './use-mechanic-audit-preview'
import {
  INITIAL_MECHANIC_AUDIT_FORM_STATE,
  mechanicAuditFormReducer,
  type MechanicAuditMechanicFormEntry,
} from './mechanic-audit-form-reducer'
import { buildMechanicAuditRequest, validateMechanicAuditForm } from '../lib/mechanic-audit-request-builder'
import type {
  MechanicAuditNoTransitionFallback,
  MechanicAuditPhaseOneBoundary,
  MechanicAuditThresholds,
} from '../types/mechanic-audit.types'

export type MechanicAuditState = ReturnType<typeof useMechanicAuditState>

export const useMechanicAuditState = (context: AppSettingsRequestContext) => {
  const [form, dispatch] = useReducer(mechanicAuditFormReducer, INITIAL_MECHANIC_AUDIT_FORM_STATE)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [forcedStep, setForcedStep] = useState<number | null>(null)

  const previewMutation = useMechanicAuditPreview(context)
  const exportJob = useMechanicAuditExportJob(context)

  const preview = previewMutation.data ?? null
  const job = exportJob.jobStatus

  const validationErrors = validateMechanicAuditForm(form)
  const isFormValid = validationErrors.length === 0

  const hasStartedPreview = previewMutation.isPending || previewMutation.isSuccess || !!previewMutation.error
  const derivedActiveStep = !hasStartedPreview ? 0 : !preview ? 1 : job === null ? 2 : 3
  const activeStep = forcedStep ?? derivedActiveStep

  const showProgress = exportJob.isStarting || job !== null
  const showResults = !!job && (job.status === 'complete' || job.status === 'partial' || (job.status === 'failed' && (job.files?.length ?? 0) > 0))

  const setMechanics = (value: MechanicAuditMechanicFormEntry[]) => dispatch({ type: 'setMechanics', value })
  const setThresholds = (value: Partial<MechanicAuditThresholds>) => dispatch({ type: 'setThresholds', value })

  const handlePreview = () => {
    if (!isFormValid) return
    setForcedStep(null)
    previewMutation.mutate(buildMechanicAuditRequest(form))
  }

  const handleGenerateExport = async () => {
    if (!isFormValid || !preview) return
    await exportJob.startExport(buildMechanicAuditRequest(form))
  }

  const handleFormFieldChange = (applyChange: () => void) => {
    applyChange()
    previewMutation.reset()
    exportJob.reset()
    setForcedStep(null)
  }

  return {
    // Form state
    form,
    dispatch,
    setScopeMode: (value: 'dateRange' | 'manualReports') => handleFormFieldChange(() => dispatch({ type: 'setScopeMode', value })),
    setSince: (value: string) => handleFormFieldChange(() => dispatch({ type: 'setSince', value })),
    setUntil: (value: string) => handleFormFieldChange(() => dispatch({ type: 'setUntil', value })),
    setReportCodesText: (value: string) => handleFormFieldChange(() => dispatch({ type: 'setReportCodesText', value })),
    setEncounterId: (value: string) => handleFormFieldChange(() => dispatch({ type: 'setEncounterId', value })),
    setEncounterName: (value: string) => handleFormFieldChange(() => dispatch({ type: 'setEncounterName', value })),
    setDifficulty: (value: string) => handleFormFieldChange(() => dispatch({ type: 'setDifficulty', value })),
    setTimezone: (value: string) => handleFormFieldChange(() => dispatch({ type: 'setTimezone', value })),
    setMechanics: (value: MechanicAuditMechanicFormEntry[]) => handleFormFieldChange(() => setMechanics(value)),
    setPhaseOneBoundaryMode: (value: MechanicAuditPhaseOneBoundary['mode']) =>
      handleFormFieldChange(() => dispatch({ type: 'setPhaseOneBoundaryMode', value })),
    setPhaseTransitionPhase: (value: string) => handleFormFieldChange(() => dispatch({ type: 'setPhaseTransitionPhase', value })),
    setMarkerAbilityIdsText: (value: string) => handleFormFieldChange(() => dispatch({ type: 'setMarkerAbilityIdsText', value })),
    setFightRelativeEndTimeMs: (value: string) => handleFormFieldChange(() => dispatch({ type: 'setFightRelativeEndTimeMs', value })),
    setNoTransitionFallbackMode: (value: MechanicAuditNoTransitionFallback['mode']) =>
      handleFormFieldChange(() => dispatch({ type: 'setNoTransitionFallbackMode', value })),
    setNoTransitionFallbackAbilityIdsText: (value: string) =>
      handleFormFieldChange(() => dispatch({ type: 'setNoTransitionFallbackAbilityIdsText', value })),
    setThresholds: (value: Partial<MechanicAuditThresholds>) => setThresholds(value),

    // UI state
    advancedOpen,
    setAdvancedOpen,
    forcedStep,
    setForcedStep,
    activeStep,

    // Validation
    validationErrors,
    isFormValid,

    // Queries
    previewMutation,
    exportJob,
    preview,
    job,
    showProgress,
    showResults,

    // Actions
    handlePreview,
    handleGenerateExport,
  }
}
