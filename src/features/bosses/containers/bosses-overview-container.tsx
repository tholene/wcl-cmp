import type { FC } from 'react'
import { useRecentBosses } from '../hooks/use-recent-bosses'
import { BossesOverviewTable } from '../components/bosses-overview-table'

export const BossesOverviewContainer: FC = () => {
  const recentBossesQuery = useRecentBosses()

  if (recentBossesQuery.isPending) {
    return <p className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">Loading boss overview...</p>
  }

  if (recentBossesQuery.error) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        <p className="font-medium">Could not load boss overview.</p>
        <p className="mt-1 text-rose-100">{recentBossesQuery.error.message}</p>
      </div>
    )
  }

  const payload = recentBossesQuery.data

  if (!payload.bosses.length) {
    return (
      <div className="space-y-3">
        <header className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-xl font-semibold text-slate-100">Bosses</h2>
          <p className="mt-1 text-sm text-slate-400">{payload.source.note}</p>
        </header>

        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
          No boss pulls found in the current recent-report window.
        </div>
      </div>
    )
  }

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <h2 className="text-xl font-semibold text-slate-100">Boss Overview Index</h2>
        <p className="mt-1 text-sm text-slate-400">{payload.source.note}</p>
      </header>

      {payload.source.note.includes('failed') ? (
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-200">
          Partial data warning: some report detail fetches failed, so counts may be incomplete.
        </div>
      ) : null}

      <BossesOverviewTable bosses={payload.bosses} />
    </section>
  )
}
