import { useMemo, useState, type FC } from 'react'
import { VennLogo } from '@/components/venn-logo'
import { AdvancedButton } from '@/components/ui/advanced-button'
import { ChipChangeBtn } from '@/components/ui/chip-change-btn'
import { StepDot } from '@/components/ui/step-dot'
import { cn } from '@/lib/utils'
import { SettingsButton } from '@/features/settings/components/settings-button'
import { SettingsFirstRunDialog } from '@/features/settings/components/settings-first-run-dialog'
import { SettingsSidebar } from '@/features/settings/components/settings-sidebar'
import { useAppSettings } from '@/features/settings/hooks/use-app-settings'
import { buildSettingsRequestContext } from '@/features/settings/lib/settings-request-context'
import { MechanicAuditAdvancedSidebar } from '../components/mechanic-audit-advanced-sidebar'
import { MechanicAuditExportButton } from '../components/mechanic-audit-export-button'
import { MechanicAuditExportProgress } from '../components/mechanic-audit-export-progress'
import { MechanicAuditExportResults } from '../components/mechanic-audit-export-results'
import { MechanicAuditMechanicsForm } from '../components/mechanic-audit-mechanics-form'
import { MechanicAuditPreviewPanel } from '../components/mechanic-audit-preview-panel'
import { MechanicAuditScopeForm } from '../components/mechanic-audit-scope-form'
import { useMechanicAuditState } from '../hooks/use-mechanic-audit-state'

const STEP_LABELS = ['Configure scope & mechanics', 'Preview pulls', 'Review & export', 'Export results']

export const MechanicAuditPage: FC = () => {
  const appSettings = useAppSettings()
  const requestContext = useMemo(() => buildSettingsRequestContext(appSettings.settings), [appSettings.settings])
  const s = useMechanicAuditState(requestContext)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [firstRunSiteDialogOpen, setFirstRunSiteDialogOpen] = useState(() => !appSettings.hasExplicitSite)

  return (
    <div className="min-h-screen">
      {/* ── Minimal Header ── */}
      <header className="mx-auto flex max-w-[700px] items-center justify-between px-6 py-[14px]">
        <div className="flex items-center gap-2">
          <VennLogo size={22} />
          <span className="text-[15px] font-bold tracking-[-0.01em]">Mechanic Audit</span>
        </div>
        <div className="flex items-center gap-2">
          <SettingsButton onClick={() => setSettingsOpen(true)} />
          <AdvancedButton onClick={() => s.setAdvancedOpen(true)} />
        </div>
      </header>

      {/* ── Accordion Steps ── */}
      <div className="mx-auto flex max-w-[700px] flex-col gap-1.5 px-6 pb-[60px]">
        {STEP_LABELS.map((label, idx) => {
          const completed = idx < s.activeStep
          const active = idx === s.activeStep
          if (idx > s.activeStep) return null

          return (
            <div key={idx} className={cn('glass transition-all duration-[250ms]', active && 'glass-active')}>
              {/* Step header row */}
              <div className={cn('flex items-center gap-3 px-4', completed ? 'py-[10px]' : 'py-[14px]')}>
                <StepDot
                  number={idx + 1}
                  completed={completed}
                  active={active}
                  loading={
                    (idx === 1 && s.previewMutation.isPending) ||
                    (idx === 3 && (s.exportJob.isStarting || s.job?.status === 'running'))
                  }
                />

                {completed ? (
                  <>
                    {idx === 0 && (
                      <div className="flex flex-1 min-w-0 items-center gap-2.5">
                        <span className="text-sm font-semibold">
                          {s.form.encounterName || `Encounter ${s.form.encounterId}`}
                        </span>
                        <span className="text-xs text-hint">{s.form.mechanics.length} mechanic{s.form.mechanics.length !== 1 ? 's' : ''}</span>
                        <div className="flex-1" />
                        <ChipChangeBtn onClick={() => s.setForcedStep(0)} />
                      </div>
                    )}
                    {idx === 1 && (
                      <div className="flex flex-1 min-w-0 items-center gap-2.5">
                        <span className="text-sm font-semibold">Preview loaded</span>
                        {s.preview && <span className="text-xs text-hint">{s.preview.estimatedPullCount} pulls</span>}
                      </div>
                    )}
                    {idx === 2 && (
                      <div className="flex flex-1 min-w-0 items-center gap-2.5">
                        <span className="text-sm font-semibold">Export started</span>
                        <div className="flex-1" />
                        <ChipChangeBtn onClick={() => s.setForcedStep(2)} />
                      </div>
                    )}
                  </>
                ) : (
                  <span className={cn('text-sm font-semibold', !active && 'text-hint')}>{label}</span>
                )}
              </div>

              {/* Active step content */}
              {active && (
                <div className="px-4 pb-[18px] flex flex-col gap-3">
                  {idx === 0 && (
                    <>
                      <MechanicAuditScopeForm
                        scopeMode={s.form.scopeMode}
                        since={s.form.since}
                        until={s.form.until}
                        reportCodesText={s.form.reportCodesText}
                        encounterId={s.form.encounterId}
                        encounterName={s.form.encounterName}
                        difficulty={s.form.difficulty}
                        timezone={s.form.timezone}
                        onScopeModeChange={s.setScopeMode}
                        onSinceChange={s.setSince}
                        onUntilChange={s.setUntil}
                        onReportCodesTextChange={s.setReportCodesText}
                        onEncounterIdChange={s.setEncounterId}
                        onEncounterNameChange={s.setEncounterName}
                        onDifficultyChange={s.setDifficulty}
                        onTimezoneChange={s.setTimezone}
                      />
                      <MechanicAuditMechanicsForm
                        mechanics={s.form.mechanics}
                        onMechanicsChange={s.setMechanics}
                        phaseOneBoundaryMode={s.form.phaseOneBoundaryMode}
                        phaseTransitionPhase={s.form.phaseTransitionPhase}
                        markerAbilityIdsText={s.form.markerAbilityIdsText}
                        fightRelativeEndTimeMs={s.form.fightRelativeEndTimeMs}
                        noTransitionFallbackMode={s.form.noTransitionFallbackMode}
                        noTransitionFallbackAbilityIdsText={s.form.noTransitionFallbackAbilityIdsText}
                        onPhaseOneBoundaryModeChange={s.setPhaseOneBoundaryMode}
                        onPhaseTransitionPhaseChange={s.setPhaseTransitionPhase}
                        onMarkerAbilityIdsTextChange={s.setMarkerAbilityIdsText}
                        onFightRelativeEndTimeMsChange={s.setFightRelativeEndTimeMs}
                        onNoTransitionFallbackModeChange={s.setNoTransitionFallbackMode}
                        onNoTransitionFallbackAbilityIdsTextChange={s.setNoTransitionFallbackAbilityIdsText}
                      />
                      {s.validationErrors.length > 0 && (
                        <div className="alert-warning">
                          {s.validationErrors.map((err, i) => (
                            <p key={i}>{err}</p>
                          ))}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={s.handlePreview}
                        disabled={!s.isFormValid || s.previewMutation.isPending}
                        className="w-full cursor-pointer rounded-lg border-none bg-[linear-gradient(135deg,#5865f2,#4752c4)] px-5 py-3 font-sans text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {s.previewMutation.isPending ? 'Previewing…' : 'Preview pulls'}
                      </button>
                    </>
                  )}

                  {idx === 1 && (
                    <>
                      {s.previewMutation.isPending && <div className="text-xs text-muted">Scanning reports…</div>}
                      {s.previewMutation.isError && (
                        <div className="alert-error">
                          {s.previewMutation.error instanceof Error ? s.previewMutation.error.message : 'Preview failed.'}
                        </div>
                      )}
                      {s.previewMutation.isError && (
                        <button
                          type="button"
                          onClick={s.handlePreview}
                          className="w-full cursor-pointer rounded-lg border border-white/[0.08] bg-transparent px-[14px] py-2 font-sans text-xs text-muted"
                        >
                          Try again
                        </button>
                      )}
                    </>
                  )}

                  {idx === 2 && s.preview && (
                    <>
                      <MechanicAuditPreviewPanel preview={s.preview} />
                      <MechanicAuditExportButton
                        onClick={s.handleGenerateExport}
                        disabled={s.exportJob.isStarting || s.preview.estimatedPullCount === 0}
                        isStarting={s.exportJob.isStarting}
                      />
                      {s.exportJob.startError && <div className="alert-error">{s.exportJob.startError}</div>}
                    </>
                  )}

                  {idx === 3 && (
                    <>
                      {s.showProgress && !s.showResults && s.job && <MechanicAuditExportProgress job={s.job} />}
                      {s.exportJob.isStarting && !s.job && <div className="text-xs text-muted">Starting export…</div>}
                      {s.showResults && s.job && s.exportJob.auditId && (
                        <MechanicAuditExportResults job={s.job} auditId={s.exportJob.auditId} onReset={s.exportJob.reset} />
                      )}
                      {s.job?.status === 'failed' && !s.showResults && (
                        <button
                          type="button"
                          onClick={s.exportJob.reset}
                          className="w-full cursor-pointer rounded-lg border border-white/[0.08] bg-transparent px-[14px] py-2 font-sans text-xs text-muted"
                        >
                          Try again
                        </button>
                      )}
                      {s.exportJob.pollError && <div className="alert-warning">{s.exportJob.pollError}</div>}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Advanced Sidebar ── */}
      <MechanicAuditAdvancedSidebar
        open={s.advancedOpen}
        onClose={() => s.setAdvancedOpen(false)}
        thresholds={s.form.thresholds}
        onThresholdsChange={s.setThresholds}
      />

      {settingsOpen && (
        <SettingsSidebar
          onClose={() => setSettingsOpen(false)}
          settings={appSettings.settings}
          onSave={appSettings.updateSettings}
          onClearAll={appSettings.clearSettings}
        />
      )}

      <SettingsFirstRunDialog
        open={firstRunSiteDialogOpen}
        onChooseSite={(site) => {
          appSettings.updateSettings((prev) => ({ ...prev, wclSite: site }))
          setFirstRunSiteDialogOpen(false)
        }}
      />
    </div>
  )
}
