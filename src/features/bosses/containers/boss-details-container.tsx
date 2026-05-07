import type { FC } from 'react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { BossFightsTable } from '../components/boss-fights-table'
import { useRecentBossFights } from '../hooks/use-recent-boss-fights'
import { BossesMapper } from '../mappers/bosses.mapper'
import { PATHS } from '@/lib/routes'

export const BossDetailsContainer: FC = () => {
  const params = useParams()
  const encounterIdValue = Number(params.encounterId)
  const encounterId = Number.isFinite(encounterIdValue) && encounterIdValue > 0 ? encounterIdValue : undefined

  const bossFightsQuery = useRecentBossFights(encounterId)

  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [resultFilter, setResultFilter] = useState<'all' | 'kill' | 'wipe'>('all')

  const payload = bossFightsQuery.data

  const availableDifficulties = useMemo(
    () =>
      payload
        ? Array.from(new Set(payload.fights.map((fight) => fight.difficulty))).sort(
            (left, right) => left - right
          )
        : [],
    [payload]
  )

  const filteredFights = useMemo(
    () =>
      payload
        ? payload.fights.filter((fight) => {
            const difficultyMatch =
              difficultyFilter === 'all' || String(fight.difficulty) === difficultyFilter

            const resultMatch =
              resultFilter === 'all' || (resultFilter === 'kill' ? fight.kill : !fight.kill)

            return difficultyMatch && resultMatch
          })
        : [],
    [difficultyFilter, payload, resultFilter]
  )

  if (!encounterId) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        Invalid encounter ID in URL.
      </div>
    )
  }

  if (bossFightsQuery.isPending) {
    return <p className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">Loading boss pulls...</p>
  }

  if (bossFightsQuery.error) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        <p className="font-medium">Could not load boss pulls.</p>
        <p className="mt-1 text-rose-100">{bossFightsQuery.error.message}</p>
      </div>
    )
  }

  if (!payload) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        No boss data returned.
      </div>
    )
  }

  const killCount = payload.fights.filter((fight) => fight.kill).length
  const wipeCount = payload.fights.length - killCount
  const killRate = payload.fights.length ? Math.round((killCount / payload.fights.length) * 100) : 0

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-slate-100">{payload.boss.encounterName}</h2>
          <Link
            to={PATHS.BOSSES}
            className="inline-flex rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          >
            Back to bosses
          </Link>
        </div>

        <p className="text-sm text-slate-400">{payload.source.note}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-xs text-slate-400">Pull count</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{payload.fights.length}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-xs text-slate-400">Kills / Wipes</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">
              <span className="text-emerald-300">{killCount}</span> / <span className="text-rose-300">{wipeCount}</span>
            </p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-xs text-slate-400">Kill rate</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{killRate}%</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
            <p className="text-xs text-slate-400">Last pull</p>
            <p className="mt-1 text-sm font-medium text-slate-100">
              {payload.fights[0] ? BossesMapper.formatFightDate(payload.fights[0]) : '—'}
            </p>
          </div>
        </div>
      </header>

      {payload.source.note.includes('failed') ? (
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-200">
          Partial data warning: some report detail fetches failed, so this boss history may be incomplete.
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-300">
            <span className="mb-1 block text-xs text-slate-400">Difficulty</span>
            <select
              value={difficultyFilter}
              onChange={(event) => setDifficultyFilter(event.target.value)}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            >
              <option value="all">All</option>
              {availableDifficulties.map((difficulty) => (
                <option key={difficulty} value={String(difficulty)}>
                  {difficulty}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-300">
            <span className="mb-1 block text-xs text-slate-400">Result</span>
            <select
              value={resultFilter}
              onChange={(event) => setResultFilter(event.target.value as 'all' | 'kill' | 'wipe')}
              className="rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100"
            >
              <option value="all">All</option>
              <option value="kill">Kill</option>
              <option value="wipe">Wipe</option>
            </select>
          </label>
        </div>
      </section>

      {!filteredFights.length ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
          No pulls match the current filters.
        </div>
      ) : (
        <BossFightsTable fights={filteredFights} />
      )}
    </section>
  )
}
