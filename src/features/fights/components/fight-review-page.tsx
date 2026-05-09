import type { FC } from 'react'
import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusPill } from '@/components/ui/status-pill'
import { getBossDetailsPath, getPlayerFightReviewPath, getReportDetailsPath } from '@/lib/routes'
import { FightsMapper } from '../mappers/fights.mapper'
import type { FightReview } from '../types/fight-review'

type FightReviewPageProps = {
  review: FightReview
}

export const FightReviewPage: FC<FightReviewPageProps> = ({ review }) => {
  const firstDeath = review.deaths[0]

  const deathCountsByPlayer = review.deaths.reduce<Record<string, number>>((accumulator, death) => {
    const key = death.playerName
    accumulator[key] = (accumulator[key] ?? 0) + 1
    return accumulator
  }, {})

  const repeatedEvidencePlayers = Object.entries(deathCountsByPlayer)
    .filter(([, count]) => count > 1)
    .map(([name]) => name)

  return (
    <section className="space-y-4">
      <header className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-100">{review.encounterName}</h2>
            <p className="mt-1 text-sm text-slate-400">{review.reportTitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={getReportDetailsPath(review.reportCode)}
              className="inline-flex rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Back to report
            </Link>
            <a
              href={review.reportUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
            >
              Open WCL
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            {review.encounterId > 0 ? (
              <Link
                to={getBossDetailsPath(review.encounterId)}
                className="inline-flex rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
              >
                Back to boss
              </Link>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
            <p className="text-slate-400">Result</p>
            <div className="mt-1">
              <StatusPill text={review.kill ? 'Kill' : 'Wipe'} tone={review.kill ? 'success' : 'danger'} />
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
            <p className="text-slate-400">Difficulty</p>
            <p className="mt-1 font-medium text-slate-100">{review.difficulty}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
            <p className="text-slate-400">Duration</p>
            <p className="mt-1 font-medium text-slate-100">{FightsMapper.formatDurationFromMilliseconds(review.durationMs)}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
            <p className="text-slate-400">Deaths</p>
            <p className="mt-1 font-medium text-slate-100">{review.deaths.length}</p>
          </div>
        </div>

        <div className="mt-3 text-sm text-slate-300">
          <p>
            Pull started: <span className="text-slate-100">{FightsMapper.formatDateTime(review.startTime)}</span>
          </p>
          {firstDeath ? (
            <p className="mt-1">
              First death: <span className="text-slate-100">{firstDeath.playerName}</span> at{' '}
              <span className="text-slate-100">{FightsMapper.formatRelativeTimestamp(firstDeath.deathTimestampRelativeMs)}</span>
            </p>
          ) : (
            <p className="mt-1 text-emerald-300">No deaths recorded in this pull.</p>
          )}
        </div>
      </header>

      {review.source.partial ? (
        <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 text-sm text-amber-200">
          Data may be partial. {review.source.note}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Review shortlist</h3>
        {!review.deaths.length ? (
          <p className="mt-2 text-sm text-emerald-300">No deaths recorded. Manual review still recommended for mechanics and utility.</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {firstDeath ? <li>First death: {firstDeath.playerName}</li> : null}
            <li>Players who died: {Array.from(new Set(review.deaths.map((death) => death.playerName))).join(', ')}</li>
            <li>
              Players with multiple death evidence items:{' '}
              {repeatedEvidencePlayers.length ? repeatedEvidencePlayers.join(', ') : 'None detected from available data'}
            </li>
            {review.source.partial ? <li>Manual review recommended: source data is partial.</li> : null}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Death timeline</h3>
        {!review.deaths.length ? (
          <p className="mt-2 text-sm text-slate-300">No deaths recorded for this pull.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {review.deaths.map((death, index) => (
              <article key={`${death.playerId}-${death.deathTimestampRelativeMs}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-sm font-medium text-slate-100">
                  {FightsMapper.formatRelativeTimestamp(death.deathTimestampRelativeMs)} · {death.playerName}
                  {death.className ? <span className="text-slate-400"> · {death.className}</span> : null}
                </p>

                <p className="mt-1 text-sm text-slate-300">
                  Final lethal damage:{' '}
                  <span className="text-slate-100">
                    {death.finalDamageEvent ? FightsMapper.formatDamageEventLine(death.finalDamageEvent) : 'Unknown from available data'}
                  </span>
                </p>

                {death.playerId > 0 ? (
                  <div className="mt-2">
                    <Link
                      to={getPlayerFightReviewPath(review.reportCode, review.fightId, death.playerId)}
                      className="inline-flex rounded-md border border-violet-500/40 px-2.5 py-1 text-xs text-violet-200 hover:bg-violet-500/10"
                    >
                      Review player
                    </Link>
                  </div>
                ) : null}

                <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">Contributing damage in previous 10s</p>
                {!death.recentDamageEvents.length ? (
                  <p className="mt-1 text-sm text-slate-400">No recent damage events were available for this death window.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm text-slate-300">
                    {death.recentDamageEvents.map((event, eventIndex) => (
                      <li key={`${death.playerId}-${event.timestampRelativeMs}-${eventIndex}`}>
                        {FightsMapper.formatRelativeTimestamp(event.timestampRelativeMs)} · {FightsMapper.formatDamageEventLine(event)}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Participants</h3>
        {!review.participants.length ? (
          <p className="mt-2 text-sm text-slate-300">No participant list was available from source data.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
            <table className="min-w-full divide-y divide-slate-800 text-sm">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">Name</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">Class / Type</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">Role</th>
                  <th className="px-3 py-2 text-left font-medium text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 bg-slate-950/20">
                {review.participants.map((participant) => (
                  <tr key={participant.id}>
                    <td className="px-3 py-2 text-slate-100">{participant.name}</td>
                    <td className="px-3 py-2 text-slate-300">{participant.className ?? participant.type ?? 'Unknown'}</td>
                    <td className="px-3 py-2 text-slate-400">Not available</td>
                    <td className="px-3 py-2">
                      {participant.id > 0 ? (
                        <Link
                          to={getPlayerFightReviewPath(review.reportCode, review.fightId, participant.id)}
                          className="inline-flex rounded-md border border-violet-500/40 px-2.5 py-1 text-xs text-violet-200 hover:bg-violet-500/10"
                        >
                          Review player
                        </Link>
                      ) : (
                        <span className="text-slate-400">Player ID unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  )
}