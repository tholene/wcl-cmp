import type { FC } from 'react'
import type {
  BenchmarkCandidatesResponse,
  NormalizedBenchmarkCandidate,
  PlayerDetectedContext,
} from '../types/player-analysis.types'
import type { AvailableBaseline, ClassSpecOverride } from '../containers/player-analysis-page'
import { CLASS_NAMES, getSpecsForClass, getRoleForSpec } from '../types/wow-class-spec'
import { getCandidateKey, getExportabilityReasons } from '../utils/benchmark-candidate-utils'

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

type Props = {
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

const PERCENTILE_OPTIONS: Array<50 | 75 | 90> = [50, 75, 90]

function isSameCandidate(
  left: NormalizedBenchmarkCandidate | undefined,
  right: NormalizedBenchmarkCandidate,
): boolean {
  if (!left) return false
  return (
    left.reportCode === right.reportCode &&
    left.fightId === right.fightId &&
    left.characterName === right.characterName
  )
}

function CandidateRow({
  baselineKey,
  baseline,
  candidate,
  isSelected,
  isRecommended,
  onSelect,
}: {
  baselineKey: string
  baseline: AvailableBaseline
  candidate: NormalizedBenchmarkCandidate
  isSelected: boolean
  isRecommended: boolean
  onSelect?: (baselineKey: string, candidateKey: string) => void
}) {
  const exportable = candidate.validation.hasUsableExportTarget
  const validationReasons = getExportabilityReasons(candidate)
  const warningSummary = candidate.warnings.filter((w) => w.trim().length > 0).slice(0, 2)
  const metricAmount =
    typeof candidate.amount === 'number' ? candidate.amount.toLocaleString() : 'unknown'
  const rankingItemLevel = typeof candidate.itemLevel === 'number' ? candidate.itemLevel : null
  const durationSeconds =
    typeof candidate.durationMs === 'number' ? Math.round(candidate.durationMs / 1000) : null
  const durationDeltaPct =
    typeof candidate.durationMs === 'number' &&
    typeof baseline.durationMs === 'number' &&
    baseline.durationMs > 0
      ? Math.round(((candidate.durationMs - baseline.durationMs) / baseline.durationMs) * 100)
      : null
  const itemLevelDelta =
    rankingItemLevel !== null && typeof baseline.itemLevel === 'number'
      ? rankingItemLevel - baseline.itemLevel
      : null

  return (
    <div
      className={`rounded border px-2 py-1.5 text-xs ${
        exportable
          ? 'border-slate-700 bg-slate-900/60'
          : 'border-slate-800 bg-slate-950/40 opacity-70'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <label className="flex min-w-0 items-center gap-2">
          <input
            type="radio"
            name={`benchmark-${baselineKey}`}
            checked={isSelected}
            disabled={!exportable}
            onChange={() => onSelect?.(baselineKey, getCandidateKey(candidate))}
          />
          <span className="truncate font-medium text-slate-200">
            {candidate.characterName || '—'}
          </span>
        </label>
        <div className="flex shrink-0 items-center gap-1.5">
          {isRecommended && (
            <span className="rounded bg-sky-900/50 px-1 py-0.5 text-sky-300">recommended</span>
          )}
          {isSelected && exportable && (
            <span className="rounded bg-emerald-800/50 px-1 py-0.5 text-emerald-300">selected</span>
          )}
          <span
            className={`rounded px-1 py-0.5 ${
              exportable ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'
            }`}
          >
            {exportable ? 'exportable' : 'not exportable'}
          </span>
        </div>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-2 text-slate-400">
        <span>Parse: {candidate.percentile ?? 'unknown'}th</span>
        <span>Rank: {candidate.rank ?? 'unknown'}</span>
        <span>
          {candidate.metric ?? 'metric'}: {metricAmount}
        </span>
        <span>Ranking ilvl: {rankingItemLevel ?? 'unknown'}</span>
        <span>
          ilvl Δ:{' '}
          {itemLevelDelta === null
            ? 'unknown'
            : `${itemLevelDelta > 0 ? '+' : ''}${itemLevelDelta}`}
        </span>
        <span>Duration: {durationSeconds ?? 'unknown'}s</span>
        <span>
          Duration Δ:{' '}
          {durationDeltaPct === null
            ? 'unknown'
            : `${durationDeltaPct > 0 ? '+' : ''}${durationDeltaPct}%`}
        </span>
        {candidate.serverName && (
          <span>
            {candidate.serverName}
            {candidate.region ? ` (${candidate.region})` : ''}
          </span>
        )}
        {candidate.reportCode ? (
          <span className="text-slate-500">{candidate.reportCode}</span>
        ) : (
          <span className="text-rose-400">no report</span>
        )}
        {candidate.fightId === undefined && (
          <span className="text-rose-400">no fight ID</span>
        )}
        {candidate.warnings.length > 0 && (
          <span className="text-amber-400">
            {candidate.warnings.length} warning{candidate.warnings.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      {!exportable && (
        <p className="mt-1 text-[11px] text-rose-300">
          Reasons:{' '}
          {(validationReasons.length > 0 ? validationReasons : ['failed validation']).join(', ')}
        </p>
      )}
      {warningSummary.map((warning, index) => (
        <p key={index} className="mt-0.5 text-[11px] text-amber-300">
          {warning}
        </p>
      ))}
    </div>
  )
}

export const PlayerAnalysisBenchmarkForm: FC<Props> = ({
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
  onBenchmarkContextSourceChange,
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
  const includeBenchmark = benchmarkMode !== 'none'
  const hasWclClassSpec = !!detectedContext?.className && !!detectedContext?.specName
  const hasUserClassSpec = !!playerUserContext?.className && !!playerUserContext?.specName
  const safeBaselines = availableBaselines ?? []
  const safeSelectedBaselineKeys = selectedBaselineKeys ?? new Set<string>()
  const safeSelectedCandidateKeysByBaseline = selectedCandidateKeysByBaseline ?? {}
  const candidateWarnings = candidatesResult?.warnings ?? []
  const candidateGroups = candidatesResult?.groups ?? []

  const contextLabel =
    benchmarkContextSource === 'wclDetected' && hasWclClassSpec
      ? `${detectedContext?.specName} ${detectedContext?.className} — WCL detected`
      : benchmarkContextSource === 'userProvided' && hasUserClassSpec
        ? `${playerUserContext?.specName} ${playerUserContext?.className} — user provided`
        : null

  return (
    <div className="space-y-3">
      {/* Include benchmark toggle — allows disabling entirely */}
      <label className="flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={includeBenchmark}
          onChange={(e) => onBenchmarkModeChange(e.target.checked ? 'auto' : 'none')}
        />
        Include benchmark comparison
      </label>

      {includeBenchmark && (
        <div className="space-y-3">
          {/* Auto mode primary */}
          {benchmarkMode === 'auto' && (
            <div className="space-y-3">
              {/* Context badge */}
              <div className="rounded border border-slate-700 bg-slate-950/50 p-2.5 text-xs">
                <p className="text-slate-300 text-[10px] font-semibold uppercase tracking-wide mb-1">
                  Benchmark context
                </p>
                <p className="text-slate-300">
                  Same encounter · same difficulty ·{' '}
                  {contextLabel ? (
                    <span className="text-slate-100">{contextLabel}</span>
                  ) : (
                    <span className="text-amber-300">class/spec required</span>
                  )}
                </p>
                {specDetectionFailed && !hasUserClassSpec && (
                  <p className="mt-1 text-amber-300">
                    WCL did not detect class/spec. Select manually below to enable benchmark discovery.
                  </p>
                )}
                {specDetectionFailed && (
                  <div className="mt-2 flex gap-2">
                    <select
                      className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                      value={playerUserContext?.className ?? ''}
                      onChange={(e) => {
                        const nextClass = e.target.value
                        if (!nextClass) {
                          onClassSpecOverrideChange?.(null)
                          return
                        }
                        const retainedSpec =
                          playerUserContext?.className === nextClass
                            ? (playerUserContext?.specName ?? '')
                            : ''
                        const nextRole = retainedSpec
                          ? (getRoleForSpec(nextClass, retainedSpec) ?? undefined)
                          : undefined
                        onClassSpecOverrideChange?.({ className: nextClass, specName: retainedSpec, role: nextRole })
                      }}
                    >
                      <option value="">Select class…</option>
                      {CLASS_NAMES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                      value={playerUserContext?.specName ?? ''}
                      disabled={!playerUserContext?.className}
                      onChange={(e) => {
                        if (!playerUserContext?.className) return
                        const nextSpec = e.target.value
                        if (!nextSpec) {
                          onClassSpecOverrideChange?.({
                            className: playerUserContext.className,
                            specName: '',
                            role: undefined,
                          })
                          return
                        }
                        const role =
                          getRoleForSpec(playerUserContext.className, nextSpec) ?? undefined
                        onClassSpecOverrideChange?.({
                          className: playerUserContext.className,
                          specName: nextSpec,
                          role,
                        })
                      }}
                    >
                      <option value="">Select spec…</option>
                      {getSpecsForClass(playerUserContext?.className ?? '').map((s) => (
                        <option key={s.specName} value={s.specName}>
                          {s.specName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Find button / auto status */}
              {isAutoTriggered && isFindingCandidates && (
                <p className="text-sm text-slate-400">Searching for same-spec benchmark candidates…</p>
              )}
              {(!isAutoTriggered || (!isFindingCandidates && !candidatesResult)) && (
                <button
                  type="button"
                  onClick={onFindCandidates}
                  disabled={!canFindCandidates || isFindingCandidates}
                  className="w-full rounded border border-indigo-700 bg-indigo-900/30 px-3 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-900/50 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
                >
                  {isFindingCandidates ? 'Searching…' : 'Find same-spec benchmark'}
                </button>
              )}
              {isAutoTriggered && !isFindingCandidates && candidatesResult && (
                <button
                  type="button"
                  onClick={onFindCandidates}
                  disabled={!canFindCandidates || isFindingCandidates}
                  className="w-full rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-300 disabled:opacity-50"
                >
                  Refresh candidates
                </button>
              )}

              {/* Hint messages */}
              {!canFindCandidates && !hasPreview && (
                <p className="text-xs text-slate-500">
                  Preview an export first so benchmark discovery can use the player's actual boss fights.
                </p>
              )}
              {!canFindCandidates &&
                hasPreview &&
                (safeSelectedBaselineKeys?.size ?? 0) === 0 && (
                  <p className="text-xs text-slate-500">
                    Select at least one boss fight to find benchmark candidates.
                  </p>
                )}
              {!canFindCandidates &&
                hasPreview &&
                safeSelectedBaselineKeys.size > 0 &&
                ((!hasWclClassSpec && !hasUserClassSpec) ||
                  (benchmarkContextSource === 'userProvided' && !hasUserClassSpec)) && (
                  <p className="text-xs text-slate-500">
                    Benchmark discovery requires class and spec. Select manually above.
                  </p>
                )}
              {canFindCandidates &&
                benchmarkContextSource === 'userProvided' &&
                hasUserClassSpec && (
                  <p className="text-xs text-slate-400">
                    Benchmark will use user-provided{' '}
                    <span className="text-slate-200">
                      {playerUserContext?.specName ?? 'unknown'}{' '}
                      {playerUserContext?.className ?? 'unknown'}
                    </span>{' '}
                    context.
                  </p>
                )}

              {/* Candidate export summary */}
              {candidatesResult &&
                (() => {
                  const willExport = candidateGroups.flatMap((g) =>
                    g.candidates
                      .filter((candidate) => {
                        const baselineKey = `${g.baseline.reportCode}:${g.baseline.fightId}`
                        return (
                          safeSelectedCandidateKeysByBaseline[baselineKey] ===
                            getCandidateKey(candidate) &&
                          candidate.validation.hasUsableExportTarget
                        )
                      })
                      .map((candidate) => ({ baseline: g.baseline, candidate })),
                  )
                  return (
                    <div className="rounded border border-slate-700 bg-slate-950/50 p-2 text-xs space-y-1">
                      <p className="font-medium text-slate-300">
                        Will export {willExport.length} benchmark fight
                        {willExport.length !== 1 ? 's' : ''}:
                      </p>
                      {willExport.length === 0 && (
                        <p className="text-amber-300">
                          No usable benchmark candidates — benchmark data will not be included.
                        </p>
                      )}
                      {willExport.map((e, i) => (
                        <p key={i} className="text-slate-400">
                          <span className="text-slate-300">{e.baseline.encounterName}</span>
                          {' → '}
                          <span className="text-slate-200">{e.candidate.characterName}</span>{' '}
                          <span className="text-slate-500">
                            {e.candidate.reportCode}#{e.candidate.fightId}
                          </span>
                          {e.candidate.percentile !== undefined && (
                            <span className="ml-1 text-slate-500">
                              {e.candidate.percentile}th pct
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  )
                })()}

              {/* Candidate groups */}
              {candidatesResult && (
                <div className="space-y-3">
                  {candidateWarnings.map((w, i) => (
                    <p key={i} className="rounded bg-amber-950/20 px-2 py-1 text-xs text-amber-300">
                      {w}
                    </p>
                  ))}
                  {candidateGroups.map((group) => {
                    const groupWarnings = group.warnings ?? []
                    const groupCandidates = group.candidates ?? []
                    const baselineKey = `${group.baseline.reportCode}:${group.baseline.fightId}`
                    const selectedCandidateKey = safeSelectedCandidateKeysByBaseline[baselineKey]
                    return (
                      <div
                        key={`${group.baseline.reportCode}-${group.baseline.fightId}`}
                        className="space-y-1 rounded border border-slate-800 bg-slate-950/30 p-2"
                      >
                        <p className="text-xs font-medium text-slate-300">
                          {group.baseline.encounterName}
                          <span className="ml-2 font-normal text-slate-500">
                            {group.baseline.reportCode}#{group.baseline.fightId}
                          </span>
                        </p>
                        {!group.apiSupported && (
                          <p className="text-xs text-amber-300">
                            WCL API not supported — use manual benchmark mode.
                          </p>
                        )}
                        {groupWarnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-300">
                            {w}
                          </p>
                        ))}
                        {groupCandidates.length > 0 && (
                          <>
                            <p className="text-xs text-slate-500">
                              {groupCandidates.filter((c) => c.validation.hasUsableExportTarget)
                                .length}{' '}
                              usable / {groupCandidates.length} total
                            </p>
                            {groupCandidates.map((c, i) => (
                              <CandidateRow
                                key={`${c.reportCode ?? i}-${c.fightId ?? i}`}
                                baselineKey={baselineKey}
                                baseline={
                                  safeBaselines.find((b) => b.key === baselineKey) ?? {
                                    key: baselineKey,
                                    reportCode: group.baseline.reportCode,
                                    reportTitle: '',
                                    fightId: group.baseline.fightId,
                                    encounterId: group.baseline.encounterId,
                                    encounterName:
                                      group.baseline.encounterName ?? 'unknown encounter',
                                    difficulty: group.baseline.difficulty,
                                    durationMs: group.baseline.durationMs ?? 0,
                                    kill: false,
                                    playerName: group.baseline.playerName,
                                    className: group.baseline.className,
                                    specName: group.baseline.specName,
                                    itemLevel: group.baseline.itemLevel ?? null,
                                  }
                                }
                                candidate={c}
                                isSelected={selectedCandidateKey === getCandidateKey(c)}
                                isRecommended={isSameCandidate(group.selectedCandidate, c)}
                                onSelect={onBenchmarkCandidateSelectionChange}
                              />
                            ))}
                          </>
                        )}
                        {groupCandidates.length === 0 && group.apiSupported && (
                          <p className="text-xs text-slate-400">
                            No rankings returned from WCL for this encounter and spec.
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Advanced benchmark config */}
              <details className="rounded border border-slate-700 bg-slate-950/30 p-2">
                <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                  Advanced benchmark options
                </summary>
                <div className="mt-3 space-y-3 text-xs">
                  {/* Baseline fight selection (for multi-fight) */}
                  {safeBaselines.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Baseline fights</span>
                        <span className="flex gap-2 text-slate-500">
                          <button
                            type="button"
                            className="hover:text-slate-300"
                            onClick={() =>
                              onBaselineSelectionChange?.(
                                new Set(safeBaselines.map((b) => b.key)),
                              )
                            }
                          >
                            All
                          </button>
                          <button
                            type="button"
                            className="hover:text-slate-300"
                            onClick={() => onBaselineSelectionChange?.(new Set())}
                          >
                            None
                          </button>
                        </span>
                      </div>
                      {safeBaselines.map((b) => {
                        const checked = safeSelectedBaselineKeys.has(b.key)
                        return (
                          <label
                            key={b.key}
                            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-800/40"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                const next = new Set(safeSelectedBaselineKeys)
                                if (e.target.checked) next.add(b.key)
                                else next.delete(b.key)
                                onBaselineSelectionChange?.(next)
                              }}
                            />
                            <span className="min-w-0 flex-1 truncate font-medium text-slate-200">
                              {b.encounterName}
                            </span>
                            <span className={b.kill ? 'text-emerald-400' : 'text-rose-400'}>
                              {b.kill ? 'kill' : 'wipe'}
                            </span>
                            <span className="text-slate-500">{Math.round(b.durationMs / 1000)}s</span>
                            <span className="text-slate-600">
                              {b.reportCode}#{b.fightId}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {/* Context override */}
                  <div className="rounded border border-slate-700 bg-slate-950/50 p-2 space-y-2">
                    <p className="text-slate-300">WCL-detected context</p>
                    <p className="text-slate-500">
                      Class:{' '}
                      <span className="text-slate-300">{detectedContext?.className ?? 'unknown'}</span>
                      {' · '}Spec:{' '}
                      <span className="text-slate-300">{detectedContext?.specName ?? 'unknown'}</span>
                      {' · '}Role:{' '}
                      <span className="text-slate-300">
                        {detectedContext?.role?.toUpperCase() ?? 'unknown'}
                      </span>
                    </p>

                    <p className="text-slate-300">User-provided override</p>
                    <div className="flex gap-2">
                      <select
                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                        value={playerUserContext?.className ?? ''}
                        onChange={(e) => {
                          const nextClass = e.target.value
                          if (!nextClass) {
                            onClassSpecOverrideChange?.(null)
                            return
                          }
                          const retainedSpec =
                            playerUserContext?.className === nextClass
                              ? (playerUserContext?.specName ?? '')
                              : ''
                          const nextRole = retainedSpec
                            ? (getRoleForSpec(nextClass, retainedSpec) ?? undefined)
                            : undefined
                          onClassSpecOverrideChange?.({
                            className: nextClass,
                            specName: retainedSpec,
                            role: nextRole,
                          })
                        }}
                      >
                        <option value="">Select class…</option>
                        {CLASS_NAMES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <select
                        className="flex-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 disabled:opacity-50"
                        value={playerUserContext?.specName ?? ''}
                        disabled={!playerUserContext?.className}
                        onChange={(e) => {
                          if (!playerUserContext?.className) return
                          const nextSpec = e.target.value
                          if (!nextSpec) {
                            onClassSpecOverrideChange?.({
                              className: playerUserContext.className,
                              specName: '',
                              role: undefined,
                            })
                            return
                          }
                          const role =
                            getRoleForSpec(playerUserContext.className, nextSpec) ?? undefined
                          onClassSpecOverrideChange?.({
                            className: playerUserContext.className,
                            specName: nextSpec,
                            role,
                          })
                        }}
                      >
                        <option value="">Select spec…</option>
                        {getSpecsForClass(playerUserContext?.className ?? '').map((s) => (
                          <option key={s.specName} value={s.specName}>
                            {s.specName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="text-slate-500">
                      Role:{' '}
                      <span className="text-slate-300">
                        {playerUserContext?.role?.toUpperCase() ?? 'unknown'}
                      </span>
                    </p>

                    <label className="block text-slate-300">Benchmark context source</label>
                    <select
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                      value={benchmarkContextSource}
                      onChange={(e) =>
                        onBenchmarkContextSourceChange?.(
                          e.target.value as 'wclDetected' | 'userProvided',
                        )
                      }
                    >
                      <option value="wclDetected">WCL-detected</option>
                      <option value="userProvided">User-provided</option>
                    </select>

                    {contextWarnings.map((warning) => (
                      <p key={warning} className="text-amber-300">
                        {warning}
                      </p>
                    ))}
                  </div>

                  {/* Target percentile */}
                  <div>
                    <label className="block text-slate-400">Target percentile</label>
                    <div className="mt-1 flex gap-1.5">
                      {PERCENTILE_OPTIONS.map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => onAutoConfigChange({ ...autoConfig, targetPercentile: pct })}
                          className={`flex-1 rounded border px-2 py-1 transition-colors ${
                            autoConfig.targetPercentile === pct
                              ? 'border-indigo-600 bg-indigo-900/40 text-indigo-300'
                              : 'border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-300'
                          }`}
                        >
                          {pct}th
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400">
                      Metric <span className="text-slate-500">— use "hps" for healers</span>
                    </label>
                    <input
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                      value={autoConfig.metric}
                      onChange={(e) => onAutoConfigChange({ ...autoConfig, metric: e.target.value })}
                      placeholder="dps"
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-slate-400">±ilvl window</label>
                      <input
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                        type="number"
                        min={0}
                        max={100}
                        value={autoConfig.itemLevelWindow}
                        onChange={(e) =>
                          onAutoConfigChange({ ...autoConfig, itemLevelWindow: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-slate-400">±% kill time</label>
                      <input
                        className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
                        type="number"
                        min={0}
                        max={100}
                        value={autoConfig.durationWindowPercent}
                        onChange={(e) =>
                          onAutoConfigChange({
                            ...autoConfig,
                            durationWindowPercent: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </details>
            </div>
          )}

          {/* Manual mode */}
          {benchmarkMode === 'manual' && (
            <div className="space-y-3">
              <div className="rounded border border-slate-700 bg-slate-950/50 p-2 text-xs text-slate-400">
                Provide a specific log to compare against. Same class and spec will be verified — if
                they cannot be confirmed, the comparison will be flagged.
              </div>

              <div>
                <label className="block text-xs text-slate-400">Benchmark report code</label>
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  value={benchmarkConfig.reportCode}
                  onChange={(e) =>
                    onBenchmarkConfigChange({ ...benchmarkConfig, reportCode: e.target.value })
                  }
                  placeholder="e.g. aAbBcCdDeEfF"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400">Benchmark fight ID</label>
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  value={benchmarkConfig.fightId}
                  onChange={(e) =>
                    onBenchmarkConfigChange({ ...benchmarkConfig, fightId: e.target.value })
                  }
                  placeholder="e.g. 5"
                  type="number"
                  min={1}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400">Benchmark player name</label>
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  value={benchmarkConfig.playerName}
                  onChange={(e) =>
                    onBenchmarkConfigChange({ ...benchmarkConfig, playerName: e.target.value })
                  }
                  placeholder="Character name in that log"
                />
              </div>
            </div>
          )}

          {/* Mode switch — always available */}
          <details className="rounded border border-slate-700 bg-slate-950/30 p-2">
            <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-300">
              Switch benchmark mode (current: {benchmarkMode})
            </summary>
            <div className="mt-2 flex rounded border border-slate-700 bg-slate-950/50 p-0.5 text-xs">
              {(['manual', 'auto'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onBenchmarkModeChange(mode)}
                  className={`flex-1 rounded px-2 py-1 transition-colors ${
                    benchmarkMode === mode
                      ? 'bg-slate-700 text-slate-100'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {mode === 'manual' ? 'Manual log' : 'Auto-discover'}
                </button>
              ))}
            </div>
          </details>

          {/* Subject-only override — shown when benchmark is blocked */}
          {canUseSubjectOnlyOverride && benchmarkBlockedReason && (
            <div className="rounded border border-amber-700/40 bg-amber-950/20 p-2.5 text-xs text-amber-200 space-y-2">
              <p>{benchmarkBlockedReason}</p>
              <label className="flex items-center gap-2 text-amber-100">
                <input
                  type="checkbox"
                  checked={allowSubjectOnlyWithoutBenchmark}
                  onChange={(e) =>
                    onAllowSubjectOnlyWithoutBenchmarkChange?.(e.target.checked)
                  }
                />
                Export subject-only data without benchmark comparison.
              </label>
              <p className="text-amber-300">
                The ZIP will omit benchmark files and the README will record the omission reason.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
