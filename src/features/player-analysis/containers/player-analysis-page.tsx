import { type FC } from 'react'
import { VennLogo } from '@/components/venn-logo'
import { getDifficultyLabel } from '@/lib/difficulty'
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

const STEP_LABELS = ['Select Player', 'Pick a Fight', 'Find Benchmark', 'Export']

export const PlayerAnalysisPage: FC = () => {
  const s = usePlayerAnalysisState()

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1e1f23', color: '#f2f3f5' }}>

      {/* ── Minimal Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', maxWidth: 700, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VennLogo size={28} colorMode="blurple" />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f2f3f5', letterSpacing: '-0.01em' }}>
            WCL Compare
          </span>
        </div>
        <AdvancedButton onClick={() => s.setSidebarOpen(true)} />
      </header>

      {/* ── Accordion Steps ── */}
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 24px 60px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {STEP_LABELS.map((label, idx) => {
          const completed = idx < s.activeStep
          const active = idx === s.activeStep
          if (idx > s.activeStep) return null

          const borderColor = active ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.06)'
          const bgColor = active ? 'rgba(55,57,63,0.90)' : 'rgba(43,45,49,0.72)'

          return (
            <div
              key={idx}
              style={{
                borderRadius: active ? 14 : 12,
                border: `1px solid ${borderColor}`,
                backgroundColor: bgColor,
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                transition: 'all 0.25s ease',
              }}
            >
              {/* Step header row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: completed ? '10px 16px' : '14px 16px',
              }}>
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <SpecIcon className={(s.effectiveClassName ?? s.pendingClassName) ?? undefined} specName={s.effectiveSpecName ?? undefined} size={26} />
                        <span style={{ fontWeight: 600, fontSize: 14, color: classColor(s.effectiveClassName ?? s.pendingClassName) }}>{s.playerName}</span>
                        {s.effectiveSpecName && s.effectiveClassName && (
                          <span style={{ color: '#6d6f78', fontSize: 12 }}>{s.effectiveSpecName} {s.effectiveClassName}</span>
                        )}
                        <div style={{ flex: 1 }} />
                        <ChipChangeBtn onClick={() => { s.setForcedStep(0); s.handleScopeFieldChange(() => {}) }} />
                      </div>
                    )}
                    {idx === 1 && s.firstBaseline && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <BossImage encounterId={s.firstBaseline.encounterId} encounterName={s.firstBaseline.encounterName} size={26} />
                        <span style={{ fontWeight: 600, fontSize: 13, color: '#f2f3f5' }}>{s.firstBaseline.encounterName}</span>
                        <DiffBadge difficulty={s.firstBaseline.difficulty} />
                        <span style={{ color: '#6d6f78', fontSize: 12 }}>{formatDuration(s.firstBaseline.durationMs)}</span>
                        <div style={{ flex: 1 }} />
                        <ChipChangeBtn onClick={() => s.setForcedStep(1)} />
                      </div>
                    )}
                    {idx === 2 && s.selectedAutoCandidates.length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: '#6d6f78' }}>vs</span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: classColor(s.selectedAutoCandidates[0].benchmarkClassName) }}>
                          {s.selectedAutoCandidates[0].benchmarkPlayerName}
                        </span>
                        {s.selectedAutoCandidates[0].benchmarkPercentile !== undefined && (
                          <PercentileBar value={s.selectedAutoCandidates[0].benchmarkPercentile} compact />
                        )}
                        {s.selectedAutoCandidates[0].benchmarkItemLevel != null && (
                          <span style={{ fontSize: 12, color: '#6d6f78' }}>{s.selectedAutoCandidates[0].benchmarkItemLevel} ilvl</span>
                        )}
                        <div style={{ flex: 1 }} />
                        <ChipChangeBtn onClick={() => s.setForcedStep(2)} />
                      </div>
                    )}
                    {idx === 2 && s.selectedAutoCandidates.length === 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 13, color: '#949ba4' }}>Benchmark</span>
                        <div style={{ flex: 1 }} />
                        <ChipChangeBtn onClick={() => s.setForcedStep(2)} />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 14, fontWeight: 600, color: active ? '#f2f3f5' : '#6d6f78' }}>
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
                        <div style={{ flex: 1 }} />
                        <span style={{ fontSize: 11, color: '#6d6f78' }}>Loading…</span>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Step content */}
              {active && (
                <div style={{ padding: '4px 16px 18px', paddingLeft: 56 }}>

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
                      {s.previewMutation.isPending && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {[44, 44, 44].map((sq, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', backgroundColor: 'rgba(30,31,35,0.5)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div style={{ width: sq, height: sq, borderRadius: 10, flexShrink: 0, background: 'linear-gradient(90deg,#2b2d31 25%,#383a40 50%,#2b2d31 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease infinite' }} />
                              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                <div style={{ width: '60%', height: 14, borderRadius: 6, background: 'linear-gradient(90deg,#2b2d31 25%,#383a40 50%,#2b2d31 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease infinite' }} />
                                <div style={{ width: '40%', height: 10, borderRadius: 6, background: 'linear-gradient(90deg,#2b2d31 25%,#383a40 50%,#2b2d31 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease infinite' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {s.previewMutation.error && !s.previewMutation.isPending && (
                        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(218,55,60,0.08)', border: '1px solid rgba(218,55,60,0.20)', fontSize: 12, color: '#f38ba8' }}>
                          {(s.previewMutation.error as Error).message}
                        </div>
                      )}
                      {s.preview && !s.previewMutation.isPending && (
                        <>
                          {s.preview.recentRaidBossKills.groups.length === 0 && (
                            <p style={{ fontSize: 13, color: '#949ba4' }}>
                              No verified raid boss kills found for {s.preview.requestedPlayerName} in this scope.
                            </p>
                          )}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {s.preview.recentRaidBossKills.groups.length > 0 && (
                              <div style={{ fontSize: 12, color: '#6d6f78', marginBottom: 2 }}>
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
                                playerItemLevel={fight.playerItemLevel}
                                reportCode={fight.reportCode}
                                fightId={fight.fightId}
                                isSelected={s.isSelected(fight.reportCode, fight.fightId)}
                                duplicateReportCount={fight.duplicateReportCount}
                                onClick={() => s.handleSelectBossKill(fight.reportCode, fight.fightId)}
                              />
                            ))}
                          </div>
                          {s.selectedFightCount === 0 && (
                            <p style={{ fontSize: 13, color: '#949ba4', marginTop: 6 }}>
                              Select a boss kill to find same-spec benchmarks.
                            </p>
                          )}
                          {s.preview.recentRaidBossKills.warnings.length > 0 && (
                            <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.20)', fontSize: 12, color: '#f0b232' }}>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {!s.showProgress && !s.showResults && s.benchmarkMode === 'auto' && (
                        <>
                          {s.benchmarkCandidatesMutation.isPending && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {[34, 34, 34].map((sq, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', backgroundColor: 'rgba(30,31,35,0.5)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.03)' }}>
                                  <div style={{ width: sq, height: sq, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(90deg,#2b2d31 25%,#383a40 50%,#2b2d31 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease infinite' }} />
                                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <div style={{ width: '60%', height: 14, borderRadius: 6, background: 'linear-gradient(90deg,#2b2d31 25%,#383a40 50%,#2b2d31 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease infinite' }} />
                                    <div style={{ width: '40%', height: 10, borderRadius: 6, background: 'linear-gradient(90deg,#2b2d31 25%,#383a40 50%,#2b2d31 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s ease infinite' }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {s.benchmarkCandidatesMutation.isError && (
                            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(218,55,60,0.08)', border: '1px solid rgba(218,55,60,0.20)', fontSize: 12, color: '#f38ba8' }}>
                              Benchmark discovery failed. Retry from the Benchmark step or use manual benchmark fallback.
                            </div>
                          )}
                        </>
                      )}

                      {!s.showProgress && !s.showResults && (
                        <>
                          {s.firstBaseline && (
                            <div style={{ padding: '14px 16px', borderRadius: 10, background: 'rgba(43,45,49,0.72)', border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <SpecIcon className={s.effectiveClassName ?? undefined} specName={s.effectiveSpecName ?? undefined} size={30} />
                                <div>
                                  <span style={{ fontWeight: 600, color: classColor(s.effectiveClassName) }}>{s.playerName}</span>
                                  {s.selectedAutoCandidates.length > 0 && (
                                    <>
                                      <span style={{ color: '#6d6f78', margin: '0 8px' }}>vs</span>
                                      <span style={{ fontWeight: 600, color: classColor(s.selectedAutoCandidates[0].benchmarkClassName) }}>
                                        {s.selectedAutoCandidates[0].benchmarkPlayerName}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#949ba4', flexWrap: 'wrap' }}>
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
                            <p style={{ fontSize: 12, color: '#f0b232' }}>
                              No exportable benchmark candidate found. Try manual fallback or allow subject-only export from Advanced options.
                            </p>
                          )}
                          {s.benchmarkMode === 'auto' && !s.benchmarkCandidatesMutation.isPending && s.benchmarkCandidatesMutation.isSuccess && s.selectedGroupCount > 0 && s.selectedExportableCount === 0 && !s.allowSubjectOnlyWithoutBenchmark && (
                            <p style={{ fontSize: 12, color: '#f0b232' }}>
                              Select a benchmark candidate to continue.
                            </p>
                          )}
                          {(s.benchmarkMode !== 'auto' || (!s.benchmarkCandidatesMutation.isSuccess || s.selectedGroupCount > 0 && s.selectedExportableCount > 0)) && s.exportBlockedReason && !s.allowSubjectOnlyWithoutBenchmark && (
                            <p style={{ fontSize: 12, color: '#f0b232' }}>{s.exportBlockedReason}</p>
                          )}
                          {s.selectedViews.length === 0 && (
                            <p style={{ fontSize: 12, color: '#da373c' }}>
                              No views selected — enable export views in Advanced options.
                            </p>
                          )}
                          {s.exportJob.startError && (
                            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(218,55,60,0.08)', border: '1px solid rgba(218,55,60,0.20)', fontSize: 12, color: '#f38ba8' }}>
                              {s.exportJob.startError}
                            </div>
                          )}
                        </>
                      )}

                      {s.showProgress && !s.showResults && s.job && <PlayerAnalysisExportProgress job={s.job} />}
                      {s.exportJob.isStarting && !s.job && (
                        <div style={{ fontSize: 12, color: '#949ba4' }}>Starting export…</div>
                      )}
                      {s.showResults && s.job && s.exportJob.exportId && (
                        <PlayerAnalysisExportResults job={s.job} exportId={s.exportJob.exportId} onReset={s.exportJob.reset} />
                      )}
                      {s.job?.status === 'failed' && !s.showResults && (
                        <button
                          type="button"
                          onClick={s.exportJob.reset}
                          style={{ width: '100%', padding: '8px 14px', borderRadius: 8, background: 'none', border: '1px solid rgba(255,255,255,0.08)', color: '#949ba4', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Try again
                        </button>
                      )}
                      {s.exportJob.pollError && (
                        <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.20)', fontSize: 12, color: '#f0b232' }}>
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
