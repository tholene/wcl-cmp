import type { FC } from 'react'
import type { BenchmarkCandidatesResponse, NormalizedBenchmarkCandidate } from '../types/player-analysis.types'

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
  onBenchmarkModeChange,
  onBenchmarkConfigChange,
  onAutoConfigChange,
  onFindCandidates,
}) => {
  const includeBenchmark = benchmarkMode !== 'none'

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

              {!canFindCandidates && (
                <p className="text-xs text-slate-500">Preview an export first to enable candidate search.</p>
              )}

              {/* Results */}
              {candidatesResult && (
                <div className="space-y-1.5">
                  {!candidatesResult.apiSupported && (
                    <div className="rounded border border-amber-700/30 bg-amber-950/20 p-2 text-xs text-amber-300">
                      WCL characterRankings API could not return candidates for this encounter. Use manual benchmark
                      mode instead.
                    </div>
                  )}

                  {candidatesResult.apiSupported && candidatesResult.candidates.length === 0 && (
                    <div className="rounded border border-slate-700 bg-slate-950/40 p-2 text-xs text-slate-400">
                      No matching candidates found for this encounter and spec.
                    </div>
                  )}

                  {candidatesResult.candidates.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-slate-500">{candidatesResult.candidates.length} candidate{candidatesResult.candidates.length > 1 ? 's' : ''} found</p>
                      {candidatesResult.candidates.slice(0, 5).map((c, i) => (
                        <CandidateRow
                          key={`${c.reportCode ?? i}-${c.fightId ?? i}`}
                          candidate={c}
                          isSelected={i === 0 && c.validation.hasUsableExportTarget}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
