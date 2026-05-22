import { useState, type FC } from 'react'
import type {
  BenchmarkCandidatesResponse,
  NormalizedBenchmarkCandidate,
  PlayerDetectedContext,
} from '@/features/player-analysis/types/player-analysis.types'
import type { AvailableBaseline } from '@/features/player-analysis/types/available-baseline'
import type { ClassSpecOverride } from '@/features/player-analysis/types/class-spec-override'
import { CLASS_NAMES, getSpecsForClass, getRoleForSpec } from '@/features/player-analysis/types/wow-class-spec'
import { getCandidateKey, getExportabilityReasons } from '@/features/player-analysis/utils/benchmark-candidate-utils'
import { classColor } from '@/features/player-analysis/lib/class-colors'
import { SpecIcon } from '@/features/player-analysis/components/spec-icon'
import { PercentileBar } from '@/features/player-analysis/components/percentile-bar'

type ManualConfig = {
  reportCode: string
  fightId: string
  playerName: string
}

type AutoConfig = {
  targetPercentile: 50 | 75 | 90
  metric: string
  itemLevelWindow: number
  durationWindowPercent: number
}

type PlayerAnalysisBenchmarkFormProps = {
  benchmarkMode: 'none' | 'manual' | 'auto'
  benchmarkConfig: ManualConfig
  autoConfig: AutoConfig
  candidatesResult?: BenchmarkCandidatesResponse | null
  isFindingCandidates?: boolean
  canFindCandidates?: boolean
  hasPreview?: boolean
  availableBaselines?: AvailableBaseline[]
  selectedBaselineKeys?: Set<string>
  selectedCandidateKeysByBaseline?: Record<string, string>
  specDetectionFailed?: boolean
  detectedContext?: PlayerDetectedContext
  contextWarnings?: string[]
  benchmarkContextSource?: 'wclDetected' | 'userProvided'
  playerUserContext?: ClassSpecOverride | null
  onBaselineSelectionChange?: (keys: Set<string>) => void
  onBenchmarkCandidateSelectionChange?: (baselineKey: string, candidateKey: string) => void
  onClassSpecOverrideChange?: (ctx: ClassSpecOverride | null) => void
  onBenchmarkContextSourceChange?: (source: 'wclDetected' | 'userProvided') => void
  onBenchmarkModeChange: (mode: 'none' | 'manual' | 'auto') => void
  onBenchmarkConfigChange: (config: ManualConfig) => void
  onAutoConfigChange: (config: AutoConfig) => void
  benchmarkBlockedReason?: string | null
  canUseSubjectOnlyOverride?: boolean
  allowSubjectOnlyWithoutBenchmark?: boolean
  onAllowSubjectOnlyWithoutBenchmarkChange?: (value: boolean) => void
  onFindCandidates: () => void
  isAutoTriggered?: boolean
}

const isSameCandidate = (
  left: NormalizedBenchmarkCandidate | undefined,
  right: NormalizedBenchmarkCandidate,
): boolean => {
  if (!left) return false
  return (
    left.reportCode === right.reportCode &&
    left.fightId === right.fightId &&
    left.characterName === right.characterName
  )
}

const formatDuration = (ms: number): string => {
  const s = Math.max(Math.floor(ms / 1000), 0)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

const CandidateCard: FC<{
  baselineKey: string
  baseline: AvailableBaseline
  candidate: NormalizedBenchmarkCandidate
  isSelected: boolean
  isRecommended: boolean
  onSelect?: (baselineKey: string, candidateKey: string) => void
}> = ({
  baselineKey,
  baseline,
  candidate,
  isSelected,
  isRecommended,
  onSelect,
}) => {
  const [hovered, setHovered] = useState(false)
  const exportable = candidate.validation.hasUsableExportTarget
  const cc = classColor(candidate.className)

  const rankingItemLevel = typeof candidate.itemLevel === 'number' ? candidate.itemLevel : null
  const ilvlDelta =
    rankingItemLevel !== null && typeof baseline.itemLevel === 'number'
      ? rankingItemLevel - baseline.itemLevel
      : null
  const durationDeltaPct =
    typeof candidate.durationMs === 'number' &&
    typeof baseline.durationMs === 'number' &&
    baseline.durationMs > 0
      ? Math.round(((candidate.durationMs - baseline.durationMs) / baseline.durationMs) * 100)
      : null

  const borderColor = isSelected
    ? 'rgba(88,101,242,0.40)'
    : hovered && exportable
      ? 'rgba(255,255,255,0.10)'
      : 'rgba(255,255,255,0.06)'
  const bgColor = isSelected
    ? 'rgba(88,101,242,0.08)'
    : hovered && exportable
      ? 'rgba(49,51,56,0.85)'
      : 'rgba(43,45,49,0.72)'

  return (
    <button
      type="button"
      disabled={!exportable}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => exportable && onSelect?.(baselineKey, getCandidateKey(candidate))}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        padding: '11px 14px',
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: exportable ? 'pointer' : 'not-allowed',
        opacity: exportable ? 1 : 0.45,
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        backgroundColor: bgColor,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: isSelected ? '0 0 16px rgba(88,101,242,0.20)' : 'none',
        transition: 'all 0.15s',
      }}
    >
      {/* Avatar */}
      <SpecIcon className={candidate.className} size={34} />

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 600, fontSize: 13, color: cc }}>
            {candidate.characterName ?? '—'}
          </span>
          {isRecommended && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '1px 6px', borderRadius: 4,
              background: 'rgba(240,178,50,0.12)', border: '1px solid rgba(240,178,50,0.25)',
              fontSize: 10, fontWeight: 600, color: '#f0b232',
            }}>
              ★ Best match
            </span>
          )}
          {!exportable && (
            <span style={{
              padding: '1px 6px', borderRadius: 4,
              background: 'rgba(218,55,60,0.12)', border: '1px solid rgba(218,55,60,0.25)',
              fontSize: 10, fontWeight: 600, color: '#da373c',
            }}>
              No export data
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, fontSize: 12, color: '#949ba4', flexWrap: 'wrap', alignItems: 'center' }}>
          {candidate.percentile !== undefined && <PercentileBar value={candidate.percentile} compact />}
          {rankingItemLevel !== null && (
            <span>
              {rankingItemLevel} ilvl
              {ilvlDelta !== null && (
                <span style={{ color: ilvlDelta > 0 ? '#f0b232' : ilvlDelta < 0 ? '#60a5fa' : '#6d6f78', marginLeft: 3 }}>
                  ({ilvlDelta > 0 ? '+' : ''}{ilvlDelta})
                </span>
              )}
            </span>
          )}
          {typeof candidate.durationMs === 'number' && (
            <span>
              {formatDuration(candidate.durationMs)}
              {durationDeltaPct !== null && (
                <span style={{ color: '#6d6f78', marginLeft: 3 }}>({durationDeltaPct > 0 ? '+' : ''}{durationDeltaPct}%)</span>
              )}
            </span>
          )}
          {candidate.serverName && (
            <span style={{ color: '#6d6f78' }}>{candidate.serverName}</span>
          )}
        </div>
        {!exportable && (
          <p style={{ marginTop: 4, fontSize: 11, color: '#da373c' }}>
            {getExportabilityReasons(candidate).join(', ') || 'failed validation'}
          </p>
        )}
      </div>

      {isSelected && exportable && (
        <div style={{ color: '#5865f2', flexShrink: 0 }}>
          <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
          </svg>
        </div>
      )}
    </button>
  )
}

export const PlayerAnalysisBenchmarkForm: FC<PlayerAnalysisBenchmarkFormProps> = ({
  benchmarkMode,
  benchmarkConfig,
  autoConfig,
  candidatesResult,
  isFindingCandidates,
  canFindCandidates,
  hasPreview = false,
  availableBaselines = [],
  selectedBaselineKeys,
  selectedCandidateKeysByBaseline = {},
  specDetectionFailed = false,
  detectedContext,
  contextWarnings = [],
  benchmarkContextSource = 'wclDetected',
  playerUserContext,
  onBaselineSelectionChange,
  onBenchmarkCandidateSelectionChange,
  onClassSpecOverrideChange,
  onBenchmarkModeChange,
  onBenchmarkConfigChange,
  onAutoConfigChange,
  benchmarkBlockedReason,
  canUseSubjectOnlyOverride = false,
  allowSubjectOnlyWithoutBenchmark = false,
  onAllowSubjectOnlyWithoutBenchmarkChange,
  onFindCandidates,
  isAutoTriggered = false,
}) => {
  const [showMore, setShowMore] = useState(false)
  const includeBenchmark = benchmarkMode !== 'none'
  const hasWclClassSpec = !!detectedContext?.className && !!detectedContext?.specName
  const hasUserClassSpec = !!playerUserContext?.className && !!playerUserContext?.specName
  const safeBaselines = availableBaselines ?? []
  const safeSelectedBaselineKeys = selectedBaselineKeys ?? new Set<string>()
  const safeSelectedCandidateKeysByBaseline = selectedCandidateKeysByBaseline ?? {}
  const candidateGroups = candidatesResult?.groups ?? []
  const candidateWarnings = candidatesResult?.warnings ?? []

  const contextLabel =
    benchmarkContextSource === 'wclDetected' && hasWclClassSpec
      ? `${detectedContext?.specName} ${detectedContext?.className}`
      : benchmarkContextSource === 'userProvided' && hasUserClassSpec
        ? `${playerUserContext?.specName} ${playerUserContext?.className}`
        : null

  // Flatten all candidates from all groups for the inline view
  const allCandidateRows = candidateGroups.flatMap((group) => {
    const baselineKey = `${group.baseline.reportCode}:${group.baseline.fightId}`
    const selectedCandidateKey = safeSelectedCandidateKeysByBaseline[baselineKey]
    const baseline = safeBaselines.find((b) => b.key === baselineKey) ?? {
      key: baselineKey,
      reportCode: group.baseline.reportCode,
      reportTitle: '',
      fightId: group.baseline.fightId,
      encounterId: group.baseline.encounterId,
      encounterName: group.baseline.encounterName ?? 'unknown encounter',
      difficulty: group.baseline.difficulty,
      durationMs: group.baseline.durationMs ?? 0,
      kill: false,
      playerName: group.baseline.playerName,
      className: group.baseline.className,
      specName: group.baseline.specName,
      itemLevel: group.baseline.itemLevel ?? null,
    }
    return (group.candidates ?? []).map((c) => ({
      baselineKey,
      baseline,
      candidate: c,
      isSelected: selectedCandidateKey === getCandidateKey(c),
      isRecommended: isSameCandidate(group.selectedCandidate, c),
    }))
  })

  const visibleCandidates = showMore ? allCandidateRows : allCandidateRows.slice(0, 3)
  const hiddenCount = allCandidateRows.length - 3

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Include benchmark toggle */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#b5bac1' }}>
        <input
          type="checkbox"
          checked={includeBenchmark}
          onChange={(e) => onBenchmarkModeChange(e.target.checked ? 'auto' : 'none')}
          style={{ accentColor: '#5865f2' }}
        />
        Include benchmark comparison
      </label>

      {includeBenchmark && (
        <>
          {/* Context info bar */}
          {contextLabel && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              flexWrap: 'wrap',
              padding: '8px 12px',
              borderRadius: 8,
              background: 'rgba(88,101,242,0.05)',
              border: '1px solid rgba(88,101,242,0.12)',
              fontSize: 12,
              color: '#949ba4',
            }}>
              <span>Targeting</span>
              <span style={{ fontWeight: 600, color: '#c9cdfb' }}>{autoConfig.targetPercentile}th percentile</span>
              <span style={{ color: '#6d6f78' }}>·</span>
              <span>same encounter · difficulty · <span style={{ color: '#c9cdfb' }}>{contextLabel}</span></span>
            </div>
          )}

          {benchmarkMode === 'auto' && (
            <>
              {/* Spec detection failed — inline class/spec override */}
              {specDetectionFailed && !hasUserClassSpec && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.15)', fontSize: 12, color: '#b5bac1' }}>
                  <p style={{ color: '#f0b232', marginBottom: 8 }}>WCL did not detect class/spec. Select manually to enable benchmark discovery.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <select
                      value={playerUserContext?.className ?? ''}
                      onChange={(e) => {
                        const cls = e.target.value
                        if (!cls) { onClassSpecOverrideChange?.(null); return }
                        const retained = playerUserContext?.className === cls ? (playerUserContext?.specName ?? '') : ''
                        onClassSpecOverrideChange?.({ className: cls, specName: retained, role: retained ? (getRoleForSpec(cls, retained) ?? undefined) : undefined })
                      }}
                      style={{ flex: 1, padding: '5px 8px', borderRadius: 6, background: '#1a1b1e', border: '1px solid rgba(255,255,255,0.06)', color: '#f2f3f5', fontSize: 12, fontFamily: 'inherit' }}
                    >
                      <option value="">Select class…</option>
                      {CLASS_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={playerUserContext?.specName ?? ''}
                      disabled={!playerUserContext?.className}
                      onChange={(e) => {
                        if (!playerUserContext?.className) return
                        const spec = e.target.value
                        const role = spec ? (getRoleForSpec(playerUserContext.className, spec) ?? undefined) : undefined
                        onClassSpecOverrideChange?.({ className: playerUserContext.className, specName: spec, role })
                      }}
                      style={{ flex: 1, padding: '5px 8px', borderRadius: 6, background: '#1a1b1e', border: '1px solid rgba(255,255,255,0.06)', color: '#f2f3f5', fontSize: 12, fontFamily: 'inherit', opacity: !playerUserContext?.className ? 0.45 : 1 }}
                    >
                      <option value="">Select spec…</option>
                      {getSpecsForClass(playerUserContext?.className ?? '').map((s) => <option key={s.specName} value={s.specName}>{s.specName}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Loading */}
              {isAutoTriggered && isFindingCandidates && (
                <p style={{ fontSize: 13, color: '#b5bac1' }}>Searching for same-spec benchmark candidates…</p>
              )}

              {/* Manual find button (non-auto-triggered or no results yet) */}
              {(!isAutoTriggered || (!isFindingCandidates && !candidatesResult)) && (
                <button
                  type="button"
                  onClick={onFindCandidates}
                  disabled={!canFindCandidates || isFindingCandidates}
                  style={{
                    width: '100%', padding: '8px 14px', borderRadius: 8,
                    background: 'rgba(88,101,242,0.10)', border: '1px solid rgba(88,101,242,0.25)',
                    color: '#c9cdfb', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: (!canFindCandidates || isFindingCandidates) ? 0.5 : 1,
                  }}
                >
                  {isFindingCandidates ? 'Searching…' : 'Find same-spec benchmark'}
                </button>
              )}

              {/* Refresh button after first load */}
              {isAutoTriggered && !isFindingCandidates && candidatesResult && (
                <button
                  type="button"
                  onClick={onFindCandidates}
                  disabled={!canFindCandidates || isFindingCandidates}
                  style={{
                    width: '100%', padding: '6px 12px', borderRadius: 8,
                    background: 'none', border: '1px solid rgba(255,255,255,0.06)',
                    color: '#6d6f78', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: (!canFindCandidates || isFindingCandidates) ? 0.5 : 1,
                  }}
                >
                  Refresh candidates
                </button>
              )}

              {/* Hint messages */}
              {!canFindCandidates && !hasPreview && (
                <p style={{ fontSize: 12, color: '#6d6f78' }}>Preview a player first so benchmark discovery can use their actual boss fights.</p>
              )}
              {!canFindCandidates && hasPreview && safeSelectedBaselineKeys.size === 0 && (
                <p style={{ fontSize: 12, color: '#6d6f78' }}>Select at least one boss fight to find benchmark candidates.</p>
              )}
              {contextWarnings.map((w) => (
                <p key={w} style={{ fontSize: 12, color: '#f0b232' }}>{w}</p>
              ))}

              {/* Candidate list */}
              {candidatesResult && (
                <>
                  {candidateWarnings.map((w, i) => (
                    <p key={i} style={{ fontSize: 12, color: '#f0b232', padding: '8px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.12)' }}>{w}</p>
                  ))}
                  {allCandidateRows.length === 0 && (
                    <p style={{ fontSize: 13, color: '#949ba4' }}>No rankings returned from WCL for this encounter and spec.</p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {visibleCandidates.map(({ baselineKey, baseline, candidate, isSelected, isRecommended }) => (
                      <CandidateCard
                        key={`${candidate.reportCode ?? ''}-${candidate.fightId ?? ''}-${candidate.characterName ?? ''}`}
                        baselineKey={baselineKey}
                        baseline={baseline}
                        candidate={candidate}
                        isSelected={isSelected}
                        isRecommended={isRecommended}
                        onSelect={onBenchmarkCandidateSelectionChange}
                      />
                    ))}
                  </div>
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowMore((v) => !v)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                        padding: '8px 0', border: 'none', background: 'none',
                        color: '#6d6f78', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: showMore ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                        <polyline points="4 6 8 10 12 6" />
                      </svg>
                      {showMore ? 'Show fewer' : `Show ${hiddenCount} more`}
                    </button>
                  )}
                </>
              )}

              {/* Advanced benchmark config */}
              <details className="rounded border border-slate-700/50 bg-slate-950/20 p-2">
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
                  Advanced benchmark options
                </summary>
                <div className="mt-3 space-y-3 text-xs">
                  {safeBaselines.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Baseline fights</span>
                        <span className="flex gap-2 text-slate-500">
                          <button type="button" className="hover:text-slate-300" onClick={() => onBaselineSelectionChange?.(new Set(safeBaselines.map((b) => b.key)))}>All</button>
                          <button type="button" className="hover:text-slate-300" onClick={() => onBaselineSelectionChange?.(new Set())}>None</button>
                        </span>
                      </div>
                      {safeBaselines.map((b) => (
                        <label key={b.key} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-800/40">
                          <input
                            type="checkbox"
                            checked={safeSelectedBaselineKeys.has(b.key)}
                            onChange={(e) => {
                              const next = new Set(safeSelectedBaselineKeys)
                              if (e.target.checked) next.add(b.key)
                              else next.delete(b.key)
                              onBaselineSelectionChange?.(next)
                            }}
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{b.encounterName}</span>
                          <span className={b.kill ? 'text-emerald-400' : 'text-rose-400'}>{b.kill ? 'kill' : 'wipe'}</span>
                          <span className="text-slate-500">{Math.round(b.durationMs / 1000)}s</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-400">Target percentile</label>
                    <div className="mt-1 flex gap-1.5">
                      {([50, 75, 90] as const).map((pct) => (
                        <button key={pct} type="button" onClick={() => onAutoConfigChange({ ...autoConfig, targetPercentile: pct })}
                          className={`flex-1 rounded border px-2 py-1 transition-colors ${autoConfig.targetPercentile === pct ? 'border-indigo-600 bg-indigo-900/40 text-indigo-300' : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-300'}`}>
                          {pct}th
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400">Metric</label>
                    <input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" value={autoConfig.metric} onChange={(e) => onAutoConfigChange({ ...autoConfig, metric: e.target.value })} placeholder="dps" />
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-slate-400">±ilvl window</label>
                      <input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" type="number" min={0} max={100} value={autoConfig.itemLevelWindow} onChange={(e) => onAutoConfigChange({ ...autoConfig, itemLevelWindow: Number(e.target.value) })} />
                    </div>
                    <div className="flex-1">
                      <label className="block text-slate-400">±% kill time</label>
                      <input className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100" type="number" min={0} max={100} value={autoConfig.durationWindowPercent} onChange={(e) => onAutoConfigChange({ ...autoConfig, durationWindowPercent: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>
              </details>
            </>
          )}

          {/* Manual mode */}
          {benchmarkMode === 'manual' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, color: '#949ba4', padding: '8px 12px', borderRadius: 8, background: 'rgba(43,45,49,0.72)', border: '1px solid rgba(255,255,255,0.06)' }}>
                Provide a specific log to compare against. Same class and spec will be verified.
              </p>
              {[
                { label: 'Benchmark report code', field: 'reportCode', placeholder: 'e.g. aAbBcCdDeEfF', type: 'text' },
                { label: 'Benchmark fight ID', field: 'fightId', placeholder: 'e.g. 5', type: 'number' },
                { label: 'Benchmark player name', field: 'playerName', placeholder: 'Character name', type: 'text' },
              ].map(({ label, field, placeholder, type }) => (
                <div key={field}>
                  <label style={{ display: 'block', fontSize: 11, color: '#6d6f78', marginBottom: 4 }}>{label}</label>
                  <input
                    type={type}
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 6, background: '#1a1b1e', border: '1px solid rgba(255,255,255,0.06)', color: '#f2f3f5', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                    value={benchmarkConfig[field as keyof ManualConfig]}
                    onChange={(e) => onBenchmarkConfigChange({ ...benchmarkConfig, [field]: e.target.value })}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Mode switch */}
          <details className="rounded border border-slate-700/40 bg-slate-950/20 p-2">
            <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-400">
              Switch mode (current: {benchmarkMode})
            </summary>
            <div className="mt-2 flex rounded border border-slate-700 bg-slate-950/50 p-0.5 text-xs">
              {(['auto', 'manual'] as const).map((mode) => (
                <button key={mode} type="button" onClick={() => onBenchmarkModeChange(mode)}
                  className={`flex-1 rounded px-2 py-1 transition-colors ${benchmarkMode === mode ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-300'}`}>
                  {mode === 'manual' ? 'Manual log' : 'Auto-discover'}
                </button>
              ))}
            </div>
          </details>

          {/* Subject-only override */}
          {canUseSubjectOnlyOverride && benchmarkBlockedReason && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.20)', fontSize: 12, color: '#f0b232' }}>
              <p style={{ marginBottom: 8 }}>{benchmarkBlockedReason}</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#f2f3f5' }}>
                <input
                  type="checkbox"
                  checked={allowSubjectOnlyWithoutBenchmark}
                  onChange={(e) => onAllowSubjectOnlyWithoutBenchmarkChange?.(e.target.checked)}
                  style={{ accentColor: '#5865f2' }}
                />
                Export subject-only data without benchmark comparison.
              </label>
            </div>
          )}
        </>
      )}
    </div>
  )
}
