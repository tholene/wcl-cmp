import type { FC } from 'react'

type BenchmarkConfig = {
  reportCode: string
  fightId: string
  playerName: string
}

type Props = {
  includeBenchmark: boolean
  benchmarkConfig: BenchmarkConfig
  onIncludeBenchmarkChange: (value: boolean) => void
  onBenchmarkConfigChange: (config: BenchmarkConfig) => void
}

export const PlayerAnalysisBenchmarkForm: FC<Props> = ({
  includeBenchmark,
  benchmarkConfig,
  onIncludeBenchmarkChange,
  onBenchmarkConfigChange,
}) => (
  <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
    <h2 className="text-sm font-semibold text-slate-200">Benchmark Comparison</h2>

    <label className="mt-3 flex items-center gap-2 text-xs text-slate-300">
      <input
        type="checkbox"
        checked={includeBenchmark}
        onChange={(e) => onIncludeBenchmarkChange(e.target.checked)}
      />
      Include benchmark comparison
    </label>

    {includeBenchmark && (
      <div className="mt-3 space-y-3">
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

        <div className="rounded border border-amber-700/30 bg-amber-950/20 p-2 text-xs text-amber-300">
          Automated benchmark discovery (50/75/90 percentile) is not yet available. Use manual log above.
        </div>
      </div>
    )}
  </section>
)
