import type { FC } from 'react'
import type {
  BenchmarkCandidatesResponse,
  NormalizedBenchmarkCandidate,
  PlayerDetectedContext,
} from '../types/player-analysis.types'
import type { AvailableBaseline, ClassSpecOverride } from '../containers/player-analysis-page'
import { CLASS_NAMES, getSpecsForClass, getRoleForSpec } from '../types/wow-class-spec'

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
  specDetectionFailed?: boolean
  detectedContext?: PlayerDetectedContext
  contextWarnings?: string[]
  benchmarkContextSource?: 'wclDetected' | 'userProvided'
  playerUserContext?: ClassSpecOverride | null
  onBaselineSelectionChange?: (keys: Set<string>) => void
  onClassSpecOverrideChange?: (ctx: ClassSpecOverride | null) => void
  onBenchmarkContextSourceChange?: (source: 'wclDetected' | 'userProvided') => void
  onBenchmarkModeChange: (mode: 'none' | 'manual' | 'auto') => void
  onBenchmarkConfigChange: (config: ManualConfig) => void
  onAutoConfigChange: (config: AutoConfig) => void
  onFindCandidates: () => void
}

const PERCENTILE_OPTIONS: Array<50 | 75 | 90> = [50, 75, 90]

function CandidateRow({ candidate, isSelected }: { candidate: NormalizedBenchmarkCandidate; isSelected: boolean }) {
  const usable = candidate.validation.hasUsableExportTarget
  return (
    <div className={`rounded border px-2 py-1.5 text-xs ${usable ? 'border-slate-700 bg-slate-900/60' : 'border-slate-800 bg-slate-950/40 opacity-60'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-medium text-slate-200">{candidate.characterName || '—'}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {isSelected && usable && (
            <span className="rounded bg-emerald-800/50 px-1 py-0.5 text-emerald-300">selected</span>
          )}
          {!usable && (
            <span className="rounded bg-slate-800 px-1 py-0.5 text-slate-500">unusable</span>
          )}
        </div>
      </div>
      <div className="mt-0.5 flex flex-wrap gap-2 text-slate-400">
        {candidate.percentile !== undefined && (
          <span>{candidate.percentile}th pct</span>
        )}
        {candidate.itemLevel !== undefined && (
          <span>ilvl {candidate.itemLevel}</span>
        )}
        {candidate.durationMs !== undefined && (
          <span>{Math.round(candidate.durationMs / 1000)}s</span>
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
          <span className="text-amber-400">{candidate.warnings.length} warning{candidate.warnings.length > 1 ? 's' : ''}</span>
        )}
      </div>
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
  specDetectionFailed = false,
  detectedContext,
  contextWarnings = [],
  benchmarkContextSource = 'wclDetected',
  playerUserContext,
  onBaselineSelectionChange,
  onClassSpecOverrideChange,
  onBenchmarkContextSourceChange,
  onBenchmarkModeChange,
  onBenchmarkConfigChange,
  onAutoConfigChange,
  onFindCandidates,
}) => {
  const includeBenchmark = benchmarkMode !== 'none'
  const hasWclClassSpec = !!detectedContext?.className && !!detectedContext?.specName
  const hasUserClassSpec = !!playerUserContext?.className && !!playerUserContext?.specName

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="text-sm font-semibold text-slate-200">Benchmark Comparison</h2>

      <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={includeBenchmark}
          onChange={(e) => onBenchmarkModeChange(e.target.checked ? 'manual' : 'none')}
        />
        Include benchmark comparison
      </label>

      {includeBenchmark && (
        <div className="mt-3 space-y-3">
          {/* Mode tabs */}
          <div className="flex rounded border border-slate-700 bg-slate-950/50 p-0.5 text-xs">
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
                {mode === 'manual' ? 'Manual log' : 'Auto-discover (experimental)'}
              </button>
            ))}
          </div>

          {/* Manual mode */}
          {benchmarkMode === 'manual' && (
            <div className="space-y-3">
              <div className="rounded border border-slate-700 bg-slate-950/50 p-2 text-xs text-slate-400">
                Provide a specific log to compare against. Same class and spec will be verified — if they cannot be
                confirmed, the comparison will be flagged.
              </div>

              <div>
                <label className="block text-xs text-slate-400">Benchmark report code</label>
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  value={benchmarkConfig.reportCode}
                  onChange={(e) => onBenchmarkConfigChange({ ...benchmarkConfig, reportCode: e.target.value })}
                  placeholder="e.g. aAbBcCdDeEfF"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400">Benchmark fight ID</label>
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  value={benchmarkConfig.fightId}
                  onChange={(e) => onBenchmarkConfigChange({ ...benchmarkConfig, fightId: e.target.value })}
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
                  onChange={(e) => onBenchmarkConfigChange({ ...benchmarkConfig, playerName: e.target.value })}
                  placeholder="Character name in that log"
                />
              </div>
            </div>
          )}

          {/* Auto mode */}
          {benchmarkMode === 'auto' && (
            <div className="space-y-3">
              {/* Fight selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Boss fights to benchmark</span>
                  {availableBaselines.length > 0 && (
                    <span className="flex gap-2 text-slate-500">
                      <button
                        type="button"
                        className="hover:text-slate-300"
                        onClick={() => onBaselineSelectionChange?.(new Set(availableBaselines.map((b) => b.key)))}
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
                  )}
                </div>

                {availableBaselines.length === 0 && !hasPreview && (
                  <p className="text-xs text-slate-500">
                    Preview an export first so benchmark discovery can use the player's actual boss fights.
                  </p>
                )}

                {availableBaselines.length === 0 && hasPreview && (
                  <p className="text-xs text-amber-400">
                    No eligible boss fights found in preview (need encounterId &gt; 0, duration ≥ 60s, player present).
                  </p>
                )}

                {availableBaselines.map((b) => {
                  const checked = selectedBaselineKeys?.has(b.key) ?? false
                  return (
                    <label
                      key={b.key}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-slate-800/40"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const next = new Set(selectedBaselineKeys)
                          if (e.target.checked) next.add(b.key)
                          else next.delete(b.key)
                          onBaselineSelectionChange?.(next)
                        }}
                      />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{b.encounterName}</span>
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

              {/* Context model + manual class/spec override */}
              {hasPreview && (
                <div className="rounded border border-slate-700 bg-slate-950/50 p-2 text-xs space-y-2">
                  <div className="space-y-0.5">
                    <p className="text-slate-300">WCL-detected context</p>
                    <p className="text-slate-500">
                      Class: <span className="text-slate-300">{detectedContext?.className ?? 'unknown'}</span>
                      {' '}· Spec: <span className="text-slate-300">{detectedContext?.specName ?? 'unknown'}</span>
                      {' '}· Role: <span className="text-slate-300">{detectedContext?.role?.toUpperCase() ?? 'unknown'}</span>
                    </p>
                    <p className="text-slate-500">
                      Confidence: {detectedContext?.confidence ?? 'low'} · Source: {detectedContext?.source ?? 'unknown'}
                    </p>
                    {specDetectionFailed && (
                      <p className="text-amber-300">
                        WCL did not detect class/spec for this player. Select class/spec manually to enable benchmark discovery.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <p className="text-slate-300">User-provided context</p>
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
                          const retainedSpec = playerUserContext?.className === nextClass
                            ? playerUserContext?.specName ?? ''
                            : ''
                          const nextRole = retainedSpec ? getRoleForSpec(nextClass, retainedSpec) ?? undefined : undefined
                          onClassSpecOverrideChange?.({
                            className: nextClass,
                            specName: retainedSpec,
                            role: nextRole,
                          })
                        }}
                      >
                        <option value="">Select class…</option>
                        {CLASS_NAMES.map((c) => (
                          <option key={c} value={c}>{c}</option>
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
                          const role = getRoleForSpec(playerUserContext.className, nextSpec) ?? undefined
                          onClassSpecOverrideChange?.({
                            className: playerUserContext.className,
                            specName: nextSpec,
                            role,
                          })
                        }}
                      >
                        <option value="">Select spec…</option>
                        {getSpecsForClass(playerUserContext?.className ?? '').map((s) => (
                          <option key={s.specName} value={s.specName}>{s.specName}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-slate-500">
                      Role:{' '}
                      <span className="text-slate-300">
                        {playerUserContext?.role?.toUpperCase() ?? 'unknown'}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-slate-300">Benchmark context source</label>
                    <select
                      className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                      value={benchmarkContextSource}
                      onChange={(e) => onBenchmarkContextSourceChange?.(e.target.value as 'wclDetected' | 'userProvided')}
                    >
                      <option value="wclDetected">WCL-detected</option>
                      <option value="userProvided">User-provided</option>
                    </select>
                  </div>

                  {contextWarnings.map((warning) => (
                    <p key={warning} className="text-amber-300">{warning}</p>
                  ))}
                </div>
              )}

              {/* Percentile */}
              <div>
                <label className="block text-xs text-slate-400">Target percentile</label>
                <div className="mt-1 flex gap-1.5">
                  {PERCENTILE_OPTIONS.map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => onAutoConfigChange({ ...autoConfig, targetPercentile: pct })}
                      className={`flex-1 rounded border px-2 py-1 text-xs transition-colors ${
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
                <label className="block text-xs text-slate-400">
                  Metric{' '}
                  <span className="text-slate-500">— use "hps" for healers</span>
                </label>
                <input
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                  value={autoConfig.metric}
                  onChange={(e) => onAutoConfigChange({ ...autoConfig, metric: e.target.value })}
                  placeholder="dps"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-slate-400">±ilvl window</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                    type="number"
                    min={0}
                    max={100}
                    value={autoConfig.itemLevelWindow}
                    onChange={(e) => onAutoConfigChange({ ...autoConfig, itemLevelWindow: Number(e.target.value) })}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-slate-400">±% kill time</label>
                  <input
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
                    type="number"
                    min={0}
                    max={100}
                    value={autoConfig.durationWindowPercent}
                    onChange={(e) => onAutoConfigChange({ ...autoConfig, durationWindowPercent: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={onFindCandidates}
                disabled={!canFindCandidates || isFindingCandidates}
                className="w-full rounded border border-indigo-700 bg-indigo-900/30 px-3 py-1.5 text-xs text-indigo-300 hover:bg-indigo-900/50 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500"
              >
                {isFindingCandidates ? 'Searching…' : 'Find benchmark candidates'}
              </button>

              {/* Context-sensitive disabled hint */}
              {!canFindCandidates && !hasPreview && (
                <p className="text-xs text-slate-500">
                  Preview an export first so benchmark discovery can use the player's actual boss fights.
                </p>
              )}
              {!canFindCandidates && hasPreview && (selectedBaselineKeys?.size ?? 0) === 0 && (
                <p className="text-xs text-slate-500">
                  Select at least one boss fight from the preview to find benchmark candidates.
                </p>
              )}
              {!canFindCandidates &&
                hasPreview &&
                (selectedBaselineKeys?.size ?? 0) > 0 &&
                ((!hasWclClassSpec && !hasUserClassSpec) ||
                  (benchmarkContextSource === 'userProvided' && !hasUserClassSpec)) && (
                <p className="text-xs text-slate-500">
                  Benchmark discovery requires class and spec. WCL did not detect spec, so select it manually.
                </p>
              )}
              {canFindCandidates && benchmarkContextSource === 'userProvided' && hasUserClassSpec && (
                <p className="text-xs text-slate-400">
                  Benchmark discovery will use user-provided{' '}
                  <span className="text-slate-200">{playerUserContext.specName} {playerUserContext.className}</span> context.
                </p>
              )}

              {/* Export summary — what will actually be included */}
              {candidatesResult && (() => {
                const willExport = (candidatesResult.groups ?? []).flatMap((g) =>
                  g.candidates
                    .filter((c) => c.validation.hasUsableExportTarget)
                    .slice(0, 1)
                    .map((c) => ({ baseline: g.baseline, candidate: c }))
                )
                return (
                  <div className="rounded border border-slate-700 bg-slate-950/50 p-2 text-xs space-y-1">
                    <p className="font-medium text-slate-300">
                      Will export {willExport.length} benchmark fight{willExport.length !== 1 ? 's' : ''}:
                    </p>
                    {willExport.length === 0 && (
                      <p className="text-amber-300">No usable benchmark candidates found — benchmark data will not be included in the export.</p>
                    )}
                    {willExport.map((e, i) => (
                      <p key={i} className="text-slate-400">
                        <span className="text-slate-300">{e.baseline.encounterName}</span>
                        {' → '}
                        <span className="text-slate-200">{e.candidate.characterName}</span>
                        {' '}
                        <span className="text-slate-500">{e.candidate.reportCode}#{e.candidate.fightId}</span>
                        {e.candidate.percentile !== undefined && (
                          <span className="ml-1 text-slate-500">{e.candidate.percentile}th pct</span>
                        )}
                      </p>
                    ))}
                  </div>
                )
              })()}

              {/* Grouped results */}
              {candidatesResult && (
                <div className="space-y-3">
                  {(candidatesResult.warnings ?? []).map((w, i) => (
                    <p key={i} className="rounded bg-amber-950/20 px-2 py-1 text-xs text-amber-300">{w}</p>
                  ))}
                  {(candidatesResult.groups ?? []).map((group) => {
                    const groupWarnings = group.warnings ?? []
                    const groupCandidates = group.candidates ?? []
                    return (
                      <div key={`${group.baseline.reportCode}-${group.baseline.fightId}`} className="space-y-1">
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
                          <p key={i} className="text-xs text-amber-300">{w}</p>
                        ))}
                        {groupCandidates.length > 0 && (
                          <>
                            <p className="text-xs text-slate-500">
                              {groupCandidates.filter((c) => c.validation.hasUsableExportTarget).length} usable
                              {' '}/ {groupCandidates.length} total
                            </p>
                            {groupCandidates.map((c, i) => (
                              <CandidateRow
                                key={`${c.reportCode ?? i}-${c.fightId ?? i}`}
                                candidate={c}
                                isSelected={i === 0 && c.validation.hasUsableExportTarget}
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
            </div>
          )}
        </div>
      )}
    </section>
  )
}
