import { useMemo, useState, type FC } from 'react'
import { Link } from 'react-router-dom'
import { VennLogo } from '@/components/venn-logo'
import { PATHS } from '@/lib/routes'
import { SettingsButton } from '@/features/settings/components/settings-button'
import { SettingsFirstRunDialog } from '@/features/settings/components/settings-first-run-dialog'
import { SettingsSidebar } from '@/features/settings/components/settings-sidebar'
import { useAppSettings } from '@/features/settings/hooks/use-app-settings'
import { buildSettingsRequestContext } from '@/features/settings/lib/settings-request-context'
import { AvailabilityStep } from '../components/availability-step'
import { EvidenceStep } from '../components/evidence-step'
import { ExportStep } from '../components/export-step'
import { RaidWindowStep } from '../components/raid-window-step'
import { ReviewStep } from '../components/review-step'
import { RosterStepper } from '../components/roster-stepper'
import { ROSTER_STEP_LABELS } from '../lib/roster-steps'
import { SelectionStep } from '../components/selection-step'
import { useRosterReviewState } from '../hooks/use-roster-review-state'

const fileStemFor = (label: string): string => {
  const slug = label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `roster-review-${slug || new Date().toISOString().slice(0, 10)}`
}

export const RosterReviewPage: FC = () => {
  const appSettings = useAppSettings()
  const requestContext = useMemo(() => buildSettingsRequestContext(appSettings.settings), [appSettings.settings])
  const s = useRosterReviewState(requestContext)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [firstRunSiteDialogOpen, setFirstRunSiteDialogOpen] = useState(() => !appSettings.hasExplicitSite)
  const step = s.session.step

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-[14px]">
        <div className="flex items-center gap-2">
          <VennLogo size={28} colorMode="blurple" />
          <span className="text-[15px] font-bold tracking-[-0.01em]">WCL Compare</span>
          <span className="text-[13px] text-hint">/ Mythic Roster Review</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to={PATHS.PLAYER_ANALYSIS} className="rounded-lg border border-white/[0.06] px-3 py-1.5 text-xs text-hint hover:bg-[#313338] hover:text-slate-300">
            Player analysis
          </Link>
          <SettingsButton onClick={() => setSettingsOpen(true)} />
        </div>
      </header>

      <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-6 pb-[60px]">
        {!s.hasGuildId && (
          <div className="alert-warning">Guild ID is not configured. Add it in Settings so recent raid logs and players can be listed.</div>
        )}

        <RosterStepper
          step={step}
          maxReachable={s.maxReachable}
          loadingStep={s.evidenceJob.isRunning || s.evidenceJob.isStarting ? 2 : s.raidReportsQuery.isLoading ? 0 : null}
          onSelect={s.setStep}
        />

        <section className="glass glass-active px-5 py-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-100">
            {step + 1}. {ROSTER_STEP_LABELS[step]}
          </h2>

          {step === 0 && (
            <RaidWindowStep
              raid={s.session.raid}
              reports={s.reports}
              reportsLoading={s.raidReportsQuery.isLoading || s.raidReportsQuery.isFetching}
              reportsError={s.raidReportsQuery.error instanceof Error ? s.raidReportsQuery.error.message : null}
              reportsWarnings={s.raidReportsQuery.data?.warnings ?? []}
              onRaidChange={(raid) => s.dispatch({ type: 'setRaid', raid })}
              onToggleReport={(code) => s.dispatch({ type: 'toggleReport', code })}
              onToggleEncounter={(encounterId) => s.dispatch({ type: 'toggleEncounter', encounterId })}
              onRefresh={() => void s.raidReportsQuery.refetch()}
              onContinue={() => s.setStep(1)}
            />
          )}

          {step === 1 && (
            <AvailabilityStep
              entries={s.session.availability}
              recentPlayers={s.recentPlayers}
              recentPlayersLoading={s.recentPlayersLoading}
              logParticipantCount={s.logParticipantEntries.length}
              onAdd={(entries) => s.dispatch({ type: 'addAvailability', entries })}
              onAddFromLogs={() => s.dispatch({ type: 'addAvailability', entries: s.logParticipantEntries })}
              onUpdate={(id, patch) => s.dispatch({ type: 'updateAvailability', id, patch })}
              onRemove={(id) => s.dispatch({ type: 'removeAvailability', id })}
              onBack={() => s.setStep(0)}
              onContinue={() => s.setStep(2)}
            />
          )}

          {step === 2 && (
            <EvidenceStep
              rows={s.rows}
              evidence={s.evidence}
              job={s.evidenceJob.job}
              isRunning={s.evidenceJob.isRunning}
              isStarting={s.evidenceJob.isStarting}
              error={s.evidenceJob.startError ?? s.evidenceJob.pollError}
              selectedForCompare={s.compareSelection}
              detailsPlayer={s.detailsPlayer}
              onBuild={s.buildEvidence}
              onApplySuggestedRoles={s.applySuggestedRoles}
              onToggleCompare={s.toggleCompare}
              onOpenDetails={s.setDetailsPlayer}
              onBack={() => s.setStep(1)}
              onContinue={() => s.setStep(3)}
            />
          )}

          {step === 3 && (
            <SelectionStep
              rows={s.rows}
              summary={s.countSummary}
              onTargetsChange={(targets) => s.dispatch({ type: 'setRoleTargets', targets })}
              onDecision={(playerName, decision) =>
                decision === null
                  ? s.dispatch({ type: 'clearDecision', playerName })
                  : s.dispatch({ type: 'setDecision', playerName, patch: { decision } })
              }
              onBack={() => s.setStep(2)}
              onContinue={() => s.setStep(4)}
            />
          )}

          {step === 4 && (
            <ReviewStep
              rows={s.rows}
              compareSelection={s.compareSelection}
              comparison={s.comparison}
              comparisonNotes={s.session.comparisonNotes}
              onDecisionPatch={(playerName, patch) => s.dispatch({ type: 'setDecision', playerName, patch })}
              onToggleCompare={s.toggleCompare}
              onClearCompare={s.clearCompare}
              onSaveComparisonNote={(text) => {
                if (s.compareSelection.length !== 2) return
                s.dispatch({ type: 'addComparisonNote', note: { playerA: s.compareSelection[0], playerB: s.compareSelection[1], text } })
                s.clearCompare()
              }}
              onRemoveComparisonNote={(id) => s.dispatch({ type: 'removeComparisonNote', id })}
              onBack={() => s.setStep(3)}
              onContinue={() => s.setStep(5)}
            />
          )}

          {step === 5 && (
            <ExportStep
              markdown={s.exportMarkdown}
              json={s.exportJson}
              fileStem={fileStemFor(s.session.raid.targetRaidLabel)}
              onBack={() => s.setStep(4)}
              onReset={s.resetSession}
            />
          )}
        </section>
      </div>

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
