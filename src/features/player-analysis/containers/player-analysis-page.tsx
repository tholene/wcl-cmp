import { type FC } from 'react'
import { VennLogo } from '@/components/venn-logo'
import { getDifficultyLabel } from '@/lib/difficulty'
import { cn } from '@/lib/utils'
import { getWowClassColor } from '@/lib/wow-class'
import { AdvancedButton } from '@/features/player-analysis/components/advanced-button'
import { AdvancedSidebar } from '@/features/player-analysis/components/advanced-sidebar'
import { BenchmarkErrorBoundary } from '@/features/player-analysis/components/benchmark-error-boundary'
import { BossImage } from '@/features/player-analysis/components/boss-image'
import { BossKillCard } from '@/features/player-analysis/components/boss-kill-card'
import { ChipChangeBtn } from '@/features/player-analysis/components/chip-change-btn'
import { DiffBadge } from '@/features/player-analysis/components/diff-badge'
import { ExportButton } from '@/features/player-analysis/components/export-button'
import { PercentileBar } from '@/features/player-analysis/components/percentile-bar'
import { PlayerAnalysisBenchmarkForm } from '@/features/player-analysis/components/player-analysis-benchmark-form'
import { PlayerAnalysisExportProgress } from '@/features/player-analysis/components/player-analysis-export-progress'
import { PlayerAnalysisExportResults } from '@/features/player-analysis/components/player-analysis-export-results'
import { PlayerAnalysisPreviewPanel } from '@/features/player-analysis/components/player-analysis-preview-panel'
import { PlayerAnalysisScopeForm } from '@/features/player-analysis/components/player-analysis-scope-form'
import { SpecIcon } from '@/features/player-analysis/components/spec-icon'
import { StepDot } from '@/features/player-analysis/components/step-dot'
import { usePlayerAnalysisState } from '@/features/player-analysis/hooks/use-player-analysis-state'
import { classColor } from '@/features/player-analysis/lib/class-colors'
import { flattenAndDeduplicateBossKills, formatDuration } from '@/features/player-analysis/lib/player-analysis-utils'
import type { AvailableBaseline } from '@/features/player-analysis/types/available-baseline'

const STEP_LABELS = ['Select Player', 'Pick a Fight', 'Find Benchmark', 'Export']

// Repeated in two steps — extracted to avoid duplication
const ShimmerRows: FC<{ sq: number }> = ({ sq }) => (
  <div className="flex flex-col gap-2">
    {[0, 1, 2].map((i) => (
      <div key={i} className="shimmer-row">
        <div className="shimmer-gradient shrink-0 rounded-[10px]" style={{ width: sq, height: sq }} />
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="shimmer-gradient h-[14px] w-[60%] rounded-[6px]" />
          <div className="shimmer-gradient h-[10px] w-[40%] rounded-[6px]" />
        </div>
      </div>
    ))}
  </div>
)

export const PlayerAnalysisPage: FC = () => {
  const s = usePlayerAnalysisState()

  return (
    <div className="min-h-screen">

      {/* ── Minimal Header ── */}
      <header className="mx-auto flex max-w-[700px] items-center justify-between px-6 py-[14px]">
        <div className="flex items-center gap-2">
          <VennLogo size={28} colorMode="blurple" />
          <span className="text-[15px] font-bold tracking-[-0.01em]">
            WCL Compare
          </span>
        </div>
        <AdvancedButton onClick={() => s.setSidebarOpen(true)} />
      </header>

      {/* ── Accordion Steps ── */}
      <div className="mx-auto flex max-w-[700px] flex-col gap-1.5 px-6 pb-[60px]">
        {STEP_LABELS.map((label, idx) => {
          const completed = idx < s.activeStep
          const active = idx === s.activeStep
          if (idx > s.activeStep) return null

          return (
            <div
              key={idx}
              className={cn('glass transition-all duration-[250ms]', active && 'glass-active')}
            >
              {/* Step header row */}
              <div className={cn('flex items-center gap-3 px-4', completed ? 'py-[10px]' : 'py-[14px]')}>
                <StepDot
                  number={idx + 1}
                  completed={completed}
                  active={active}
                  loading={
                    (idx === 1 && s.previewMutation.isPending) ||
                    (idx === 2 && s.benchmarkCandidatesMutation.isPending) ||
                    (idx === 3 && (
                      s.benchmarkCandidatesMutation.isPending ||
                      s.exportJob.isStarting ||
                      s.job?.status === 'running'
                    ))
                  }
                  loadingColor={(s.effectiveClassName ?? s.pendingClassName) ? getWowClassColor((s.effectiveClassName ?? s.pendingClassName)!) : undefined}
                />

                {completed ? (
                  <>
                    {idx === 0 && (
                      <div className="flex flex-1 min-w-0 items-center gap-2.5">
                        <SpecIcon className={(s.effectiveClassName ?? s.pendingClassName) ?? undefined} specName={s.effectiveSpecName ?? undefined} size={26} />
                        <span className="text-sm font-semibold" style={{ color: classColor(s.effectiveClassName ?? s.pendingClassName) }}>{s.playerName}</span>
                        {s.effectiveSpecName && s.effectiveClassName && (
                          <span className="text-xs text-hint">{s.effectiveSpecName} {s.effectiveClassName}</span>
                        )}
                        <div className="flex-1" />
                        <ChipChangeBtn onClick={() => { s.setForcedStep(0); s.handleScopeFieldChange(() => {}) }} />
                      </div>
                    )}
                    {idx === 1 && s.firstBaseline && (
                      <div className="flex flex-1 min-w-0 items-center gap-2.5">
                        <BossImage encounterId={s.firstBaseline.encounterId} encounterName={s.firstBaseline.encounterName} size={26} />
                        <span className="text-[13px] font-semibold">{s.firstBaseline.encounterName}</span>
                        <DiffBadge difficulty={s.firstBaseline.difficulty} />
                        <span className="text-xs text-hint">{formatDuration(s.firstBaseline.durationMs)}</span>
                        <div className="flex-1" />
                        <ChipChangeBtn onClick={() => s.setForcedStep(1)} />
                      </div>
                    )}
                    {idx === 2 && s.selectedAutoCandidates.length > 0 && (
                      <div className="flex flex-1 min-w-0 items-center gap-2">
                        <span className="text-xs text-hint">vs</span>
                        <span className="text-[13px] font-semibold" style={{ color: classColor(s.selectedAutoCandidates[0].benchmarkClassName) }}>
                          {s.selectedAutoCandidates[0].benchmarkPlayerName}
                        </span>
                        {s.selectedAutoCandidates[0].benchmarkPercentile !== undefined && (
                          <PercentileBar value={s.selectedAutoCandidates[0].benchmarkPercentile} compact />
                        )}
                        {s.selectedAutoCandidates[0].benchmarkItemLevel != null && (
                          <span className="text-xs text-hint">{s.selectedAutoCandidates[0].benchmarkItemLevel} ilvl</span>
                        )}
                        <div className="flex-1" />
                        <ChipChangeBtn onClick={() => s.setForcedStep(2)} />
                      </div>
                    )}
                    {idx === 2 && s.selectedAutoCandidates.length === 0 && (
                      <div className="flex flex-1 min-w-0 items-center gap-2.5">
                        <span className="text-[13px] text-muted">Benchmark</span>
                        <div className="flex-1" />
                        <ChipChangeBtn onClick={() => s.setForcedStep(2)} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span className={cn('text-sm font-semibold', !active && 'text-hint')}>
                      {label}
                    </span>
                    {active && (
                      (idx === 1 && s.previewMutation.isPending) ||
                      (idx === 2 && s.benchmarkCandidatesMutation.isPending) ||
                      (idx === 3 && (
                        s.benchmarkCandidatesMutation.isPending ||
                        s.exportJob.isStarting ||
                        s.job?.status === 'running'
                      ))
                    ) && (
                      <>
                        <div className="flex-1" />
                        <span className="text-[11px] text-hint">Loading…</span>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Step content */}
              {active && (
                <div className="pb-[18px] pl-14 pr-4 pt-1">

                  {/* ── Step 0: Player Search ── */}
                  {idx === 0 && (
                    <PlayerAnalysisScopeForm
                      players={s.players}
                      recentPlayersLoading={s.recentPlayersQuery.isLoading}
                      recentPlayersError={s.recentPlayersQuery.error instanceof Error ? s.recentPlayersQuery.error.message : null}
                      playerName={s.playerName}
                      onPlayerNameChange={(value) => s.handleScopeFieldChange(() => s.setPlayerName(value), { resetUserContext: true })}
                      onSelect={s.handlePlayerSelect}
                      onCommit={() => {
                        const trimmed = s.playerName.trim()
                        if (!trimmed || s.previewMutation.isPending) return
                        s.resetLastPreviewedName()
                        s.setForcedStep(null)
                        s.handlePreview(trimmed)
                      }}
                      isPreviewing={s.previewMutation.isPending}
                    />
                  )}

                  {/* ── Step 1: Fight Selection ── */}
                  {idx === 1 && (
                    <div>
                      {s.previewMutation.isPending && <ShimmerRows sq={44} />}
                      {s.previewMutation.error && !s.previewMutation.isPending && (
                        <div className="alert-error">
                          {(s.previewMutation.error as Error).message}
                        </div>
                      )}
                      {s.preview && !s.previewMutation.isPending && (
                        <>
                          {s.preview.recentRaidBossKills.groups.length === 0 && (
                            <p className="text-[13px] text-muted">
                              No verified raid boss kills found for {s.preview.requestedPlayerName} in this scope.
                            </p>
                          )}
                          <div className="flex flex-col gap-1.5">
                            {s.preview.recentRaidBossKills.groups.length > 0 && (
                              <div className="mb-0.5 text-xs text-hint">
                                {s.preview.recentRaidBossKills.groups.length} boss kills from latest raid
                              </div>
                            )}
                            {flattenAndDeduplicateBossKills(s.preview.recentRaidBossKills.groups).map((fight) => (
                              <BossKillCard
                                key={`${fight.reportCode}:${fight.fightId}`}
                                encounterName={fight.encounterName}
                                encounterId={fight.encounterId}
                                difficulty={fight.difficulty}
                                durationMs={fight.durationMs}
                                startTime={fight.startTime}
                                playerParse={fight.playerParse}
                                reportCode={fight.reportCode}
                                fightId={fight.fightId}
                                isSelected={s.isSelected(fight.reportCode, fight.fightId)}
                                duplicateReportCount={fight.duplicateReportCount}
                                onClick={() => s.handleSelectBossKill(fight.reportCode, fight.fightId)}
                              />
                            ))}
                          </div>
                          {s.selectedFightCount === 0 && (
                            <p className="mt-1.5 text-[13px] text-muted">
                              Select a boss kill to find same-spec benchmarks.
                            </p>
                          )}
                          {s.preview.recentRaidBossKills.warnings.length > 0 && (
                            <div className="alert-warning mt-2">
                              {s.preview.recentRaidBossKills.warnings.map((w) => <p key={w}>⚠ {w}</p>)}
                            </div>
                          )}
                          <details className="mt-3 rounded border border-white/[0.06] bg-[rgba(26,27,30,0.4)] p-2">
                            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
                              Advanced: scope details & manual fight selection
                            </summary>
                            <div className="mt-3">
                              <PlayerAnalysisPreviewPanel
                                preview={s.preview}
                                selectedFightIdsByReport={s.selectedFightIdsByReport}
                                onFightSelectionChange={s.handleFightSelectionChange}
                                onSelectAllEligibleFights={s.handleSelectAllEligibleFights}
                                onClearFightSelection={s.handleClearFightSelection}
                                viewCount={s.selectedViews.length}
                              />
                            </div>
                          </details>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Step 2: Benchmark ── */}
                  {idx === 2 && (
                    <BenchmarkErrorBoundary>
                      <ParseBanner baseline={s.availableBaselines[0] ?? null} />
                      <TierSelector
                        currentTier={s.autoBenchmarkConfig.targetPercentile}
                        onTierChange={s.handleTargetTierChange}
                      />
                      <PlayerAnalysisBenchmarkForm
                        benchmarkMode={s.benchmarkMode}
                        benchmarkConfig={s.manualBenchmarkConfig}
                        autoConfig={s.autoBenchmarkConfig}
                        candidatesResult={s.benchmarkCandidatesMutation.data ?? null}
                        isFindingCandidates={s.benchmarkCandidatesMutation.isPending}
                        canFindCandidates={s.canFindCandidates}
                        hasPreview={!!s.preview}
                        availableBaselines={s.availableBaselines}
                        selectedBaselineKeys={s.selectedBaselineKeys}
                        selectedCandidateKeysByBaseline={s.selectedCandidateKeysByBaseline}
                        specDetectionFailed={s.specDetectionFailed}
                        detectedContext={s.preview?.detectedPlayer?.detectedContext}
                        contextWarnings={[...(s.preview?.contextWarnings ?? []), ...(s.selectedPlayerFightContext?.warnings ?? [])]}
                        benchmarkContextSource={s.benchmarkContextSource}
                        playerUserContext={s.playerUserContext}
                        onBaselineSelectionChange={s.handleBaselineSelectionChange}
                        onBenchmarkCandidateSelectionChange={s.handleBenchmarkCandidateSelection}
                        onClassSpecOverrideChange={s.setPlayerUserContext}
                        onBenchmarkContextSourceChange={s.setBenchmarkContextSource}
                        onBenchmarkModeChange={s.setBenchmarkMode}
                        onBenchmarkConfigChange={s.setManualBenchmarkConfig}
                        onAutoConfigChange={s.setAutoBenchmarkConfig}
                        benchmarkBlockedReason={s.benchmarkBlockedReason}
                        canUseSubjectOnlyOverride={s.canUseSubjectOnlyOverride}
                        allowSubjectOnlyWithoutBenchmark={s.allowSubjectOnlyWithoutBenchmark}
                        onAllowSubjectOnlyWithoutBenchmarkChange={s.setAllowSubjectOnlyWithoutBenchmark}
                        onFindCandidates={s.handleFindCandidates}
                        isAutoTriggered={true}
                      />
                    </BenchmarkErrorBoundary>
                  )}

                  {/* ── Step 3: Export ── */}
                  {idx === 3 && (
                    <div className="flex flex-col gap-3">
                      {!s.showProgress && !s.showResults && s.benchmarkMode === 'auto' && (
                        <>
                          {s.benchmarkCandidatesMutation.isPending && <ShimmerRows sq={34} />}
                          {s.benchmarkCandidatesMutation.isError && (
                            <div className="alert-error">
                              Benchmark discovery failed. Retry from the Benchmark step or use manual benchmark fallback.
                            </div>
                          )}
                        </>
                      )}

                      {!s.showProgress && !s.showResults && (
                        <>
                          {s.firstBaseline && (
                            <div className="rounded-[10px] border border-white/[0.06] bg-[rgba(43,45,49,0.72)] px-4 py-[14px] backdrop-blur-[16px]">
                              <div className="mb-2.5 flex items-center gap-2.5">
                                <SpecIcon className={s.effectiveClassName ?? undefined} specName={s.effectiveSpecName ?? undefined} size={30} />
                                <div>
                                  <span className="font-semibold" style={{ color: classColor(s.effectiveClassName) }}>{s.playerName}</span>
                                  {s.selectedAutoCandidates.length > 0 && (
                                    <>
                                      <span className="mx-2 text-hint">vs</span>
                                      <span className="font-semibold" style={{ color: classColor(s.selectedAutoCandidates[0].benchmarkClassName) }}>
                                        {s.selectedAutoCandidates[0].benchmarkPlayerName}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-3.5 text-xs text-muted">
                                <span>{s.firstBaseline.encounterName}</span>
                                <span>{getDifficultyLabel(s.firstBaseline.difficulty)}</span>
                                <span>{formatDuration(s.firstBaseline.durationMs)}</span>
                                {s.benchmarkMode !== 'none' && (
                                  <span>Target: {s.autoBenchmarkConfig.targetPercentile}th pct</span>
                                )}
                              </div>
                            </div>
                          )}

                          <ExportButton
                            onClick={s.handleGenerateExport}
                            disabled={s.exportJob.isStarting || s.selectedFightCount === 0 || s.selectedViews.length === 0 || !!s.exportBlockedReason}
                            isStarting={s.exportJob.isStarting}
                          />

                          {s.benchmarkMode === 'auto' && !s.benchmarkCandidatesMutation.isPending && !s.benchmarkCandidatesMutation.isError && s.benchmarkCandidatesMutation.isSuccess && s.selectedGroupCount === 0 && !s.allowSubjectOnlyWithoutBenchmark && (
                            <p className="text-xs text-warning">
                              No exportable benchmark candidate found. Try manual fallback or allow subject-only export from Advanced options.
                            </p>
                          )}
                          {s.benchmarkMode === 'auto' && !s.benchmarkCandidatesMutation.isPending && s.benchmarkCandidatesMutation.isSuccess && s.selectedGroupCount > 0 && s.selectedExportableCount === 0 && !s.allowSubjectOnlyWithoutBenchmark && (
                            <p className="text-xs text-warning">
                              Select a benchmark candidate to continue.
                            </p>
                          )}
                          {(s.benchmarkMode !== 'auto' || (!s.benchmarkCandidatesMutation.isSuccess || s.selectedGroupCount > 0 && s.selectedExportableCount > 0)) && s.exportBlockedReason && !s.allowSubjectOnlyWithoutBenchmark && (
                            <p className="text-xs text-warning">{s.exportBlockedReason}</p>
                          )}
                          {s.selectedViews.length === 0 && (
                            <p className="text-xs text-error-strong">
                              No views selected — enable export views in Advanced options.
                            </p>
                          )}
                          {s.exportJob.startError && (
                            <div className="alert-error">
                              {s.exportJob.startError}
                            </div>
                          )}
                        </>
                      )}

                      {s.showProgress && !s.showResults && s.job && <PlayerAnalysisExportProgress job={s.job} />}
                      {s.exportJob.isStarting && !s.job && (
                        <div className="text-xs text-muted">Starting export…</div>
                      )}
                      {s.showResults && s.job && s.exportJob.exportId && (
                        <PlayerAnalysisExportResults job={s.job} exportId={s.exportJob.exportId} onReset={s.exportJob.reset} />
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
                      {s.exportJob.pollError && (
                        <div className="alert-warning">
                          {s.exportJob.pollError}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Advanced Sidebar ── */}
      <AdvancedSidebar
        open={s.sidebarOpen}
        onClose={() => s.setSidebarOpen(false)}
        reports={s.reports}
        reportsLoading={s.recentReportsQuery.isLoading}
        reportsError={s.recentReportsQuery.error instanceof Error ? s.recentReportsQuery.error.message : null}
        timeframePreset={s.timeframePreset}
        selectedReports={s.selectedReports}
        includeKills={s.includeKills}
        includeWipes={s.includeWipes}
        includeTrash={s.includeTrash}
        onlyPlayerPresent={s.onlyPlayerPresent}
        onTimeframePresetChange={(value) => s.handleScopeFieldChange(() => s.setTimeframePreset(value))}
        onSelectedReportsChange={(value) => s.handleScopeFieldChange(() => s.setSelectedReports(value))}
        onIncludeKillsChange={(value) => s.handleScopeFieldChange(() => s.setIncludeKills(value))}
        onIncludeWipesChange={(value) => s.handleScopeFieldChange(() => s.setIncludeWipes(value))}
        onIncludeTrashChange={(value) => s.handleScopeFieldChange(() => s.setIncludeTrash(value))}
        onOnlyPlayerPresentChange={(value) => s.handleScopeFieldChange(() => s.setOnlyPlayerPresent(value))}
        benchmarkMode={s.benchmarkMode}
        manualBenchmarkConfig={s.manualBenchmarkConfig}
        autoBenchmarkConfig={s.autoBenchmarkConfig}
        onBenchmarkModeChange={s.setBenchmarkMode}
        onManualBenchmarkConfigChange={s.setManualBenchmarkConfig}
        onAutoConfigChange={s.setAutoBenchmarkConfig}
        benchmarkContextSource={s.benchmarkContextSource}
        playerUserContext={s.playerUserContext}
        onBenchmarkContextSourceChange={s.setBenchmarkContextSource}
        onClassSpecOverrideChange={s.setPlayerUserContext}
        selectedViews={s.selectedViews}
        onSelectedViewsChange={s.setSelectedViews}
      />
    </div>
  )
}

const WCL_PARSE_COLORS: Array<{ min: number; color: string }> = [
  { min: 100, color: '#e6cc80' },
  { min: 95, color: '#ff8000' },
  { min: 75, color: '#a335ee' },
  { min: 50, color: '#0070dd' },
  { min: 25, color: '#1eff00' },
  { min: 0, color: '#9d9d9d' },
]
const getParseColor = (p: number) => WCL_PARSE_COLORS.find((c) => p >= c.min)?.color ?? '#9d9d9d'

const DIFFICULTY_LABELS: Record<number, string> = { 5: 'Mythic', 4: 'Heroic', 3: 'Normal' }

const ParseBanner: FC<{ baseline: AvailableBaseline | null }> = ({ baseline }) => {
  if (!baseline) return null
  const diffLabel = DIFFICULTY_LABELS[baseline.difficulty] ?? `Diff ${baseline.difficulty}`
  return (
    <div className="parse-banner">
      {baseline.playerParse != null && (
        <>
          <span>Your parse:</span>
          <span className="font-bold" style={{ color: getParseColor(Math.round(baseline.playerParse)) }}>
            {Math.round(baseline.playerParse)}%
          </span>
          <span className="text-sep">·</span>
        </>
      )}
      <span className="font-semibold">{baseline.encounterName}</span>
      <span className="text-[11px] text-hint">{diffLabel}</span>
      <span className="text-sep">·</span>
      <span>{formatDuration(baseline.durationMs)}</span>
    </div>
  )
}

const TIERS: Array<{ value: 75 | 90 | 95 | 99 | 100; label: string }> = [
  { value: 75, label: '75th' },
  { value: 90, label: '90th' },
  { value: 95, label: '95th' },
  { value: 99, label: '99th' },
  { value: 100, label: '100th' },
]

const TierSelector: FC<{
  currentTier: number
  onTierChange: (tier: 75 | 90 | 95 | 99 | 100) => void
}> = ({ currentTier, onTierChange }) => (
  <div className="flex items-center gap-2 px-0.5">
    <span className="shrink-0 text-xs text-hint">Compare against:</span>
    <div className="flex flex-wrap gap-1.5">
      {TIERS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          onClick={() => onTierChange(value)}
          className={cn('tier-btn', currentTier === value && 'tier-btn-active')}
        >
          {label}
        </button>
      ))}
    </div>
  </div>
)
