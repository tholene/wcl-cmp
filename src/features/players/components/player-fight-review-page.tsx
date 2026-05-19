import type { FC } from 'react'
import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { StatusPill } from '@/components/ui/status-pill'
import { getFightReviewPath, getReportDetailsPath } from '@/lib/routes'
import { PlayersMapper } from '../mappers/players.mapper'
import type { PlayerFightReview } from '../types/player-fight-review'

type PlayerFightReviewPageProps = {
  review: PlayerFightReview
}

const FindingToneClassBySeverity: Record<'info' | 'warning' | 'critical', string> = {
  info: 'border-sky-700/40 bg-sky-950/20 text-sky-100',
  warning: 'border-amber-700/40 bg-amber-950/20 text-amber-100',
  critical: 'border-rose-700/40 bg-rose-950/20 text-rose-100',
}

export const PlayerFightReviewPage: FC<PlayerFightReviewPageProps> = ({ review }) => (
  <section className="space-y-4">
    <header className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">{review.player.name}</h2>
          <p className="mt-1 text-sm text-slate-400">
            {review.player.className ?? 'Unknown class'} · {review.fight.encounterName}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={getFightReviewPath(review.reportCode, review.fight.id)}
            className="inline-flex rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            Back to fight
          </Link>
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
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
          <p className="text-slate-400">Result</p>
          <div className="mt-1">
            <StatusPill text={review.fight.kill ? 'Kill' : 'Wipe'} tone={review.fight.kill ? 'success' : 'danger'} />
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
          <p className="text-slate-400">Difficulty</p>
          <p className="mt-1 font-medium text-slate-100">{review.fight.difficulty}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
          <p className="text-slate-400">Duration</p>
          <p className="mt-1 font-medium text-slate-100">{PlayersMapper.formatDurationFromMilliseconds(review.fight.durationMs)}</p>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
          <p className="text-slate-400">Pull started</p>
          <p className="mt-1 font-medium text-slate-100">{PlayersMapper.formatDateTime(review.fight.startTime)}</p>
        </div>
      </div>
    </header>

    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Assignment context</h3>
      <p className="mt-2 text-sm text-slate-300">
        <span className="font-medium text-slate-100">{review.assignmentContext.status}</span> — {review.assignmentContext.note}
      </p>
    </section>

    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Top findings</h3>
      {!review.topFindings.length ? (
        <p className="mt-2 text-sm text-slate-300">No deterministic findings were generated from available evidence.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {review.topFindings.map((finding) => (
            <article key={finding.id} className={`rounded-lg border p-3 text-sm ${FindingToneClassBySeverity[finding.severity]}`}>
              <p className="font-medium">
                {finding.title} · <span className="uppercase">{finding.category}</span>
              </p>
              <p className="mt-1">{finding.summary}</p>
              <p className="mt-1 text-xs opacity-90">Confidence: {finding.confidence}</p>
              {finding.limitation ? <p className="mt-1 text-xs opacity-90">Limitation: {finding.limitation}</p> : null}
            </article>
          ))}
        </div>
      )}
    </section>

    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Evidence categories</h3>
      <div className="mt-3 overflow-hidden rounded-lg border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800 text-sm">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-slate-300">Category</th>
              <th className="px-3 py-2 text-left font-medium text-slate-300">Summary</th>
              <th className="px-3 py-2 text-left font-medium text-slate-300">Confidence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-950/20 text-slate-300">
            <tr>
              <td className="px-3 py-2 text-slate-100">Context</td>
              <td className="px-3 py-2">{review.evidence.context.summary}</td>
              <td className="px-3 py-2">{review.evidence.context.confidence}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-slate-100">Output</td>
              <td className="px-3 py-2">{review.evidence.output.summary}</td>
              <td className="px-3 py-2">{review.evidence.output.confidence}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-slate-100">Execution</td>
              <td className="px-3 py-2">{review.evidence.execution.summary}</td>
              <td className="px-3 py-2">{review.evidence.execution.confidence}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-slate-100">Survivability</td>
              <td className="px-3 py-2">{review.evidence.survivability.summary}</td>
              <td className="px-3 py-2">{review.evidence.survivability.confidence}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-slate-100">Utility / assignments</td>
              <td className="px-3 py-2">{review.evidence.utility.summary}</td>
              <td className="px-3 py-2">{review.evidence.utility.confidence}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-slate-100">Consistency / trend</td>
              <td className="px-3 py-2">{review.evidence.consistency.summary}</td>
              <td className="px-3 py-2">{review.evidence.consistency.confidence}</td>
            </tr>
            <tr>
              <td className="px-3 py-2 text-slate-100">Confidence / limitations</td>
              <td className="px-3 py-2">{review.evidence.confidence.summary}</td>
              <td className="px-3 py-2">{review.evidence.confidence.confidence}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Deaths / survivability</h3>
      {!review.evidence.survivability.deaths.length ? (
        <p className="mt-2 text-sm text-emerald-300">No deaths recorded for this player in this pull.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {review.evidence.survivability.deaths.map((death, index) => (
            <article key={`${death.playerId}-${death.deathTimestampRelativeMs}-${index}`} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
              <p className="text-sm font-medium text-slate-100">
                {PlayersMapper.formatRelativeTimestamp(death.deathTimestampRelativeMs)} · {death.playerName}
              </p>
              <p className="mt-1 text-sm text-slate-300">
                Final lethal damage:{' '}
                <span className="text-slate-100">
                  {death.finalDamageEvent ? `${death.finalDamageEvent.abilityName} · ${death.finalDamageEvent.sourceName ?? 'Unknown source'}` : 'Unknown from available data'}
                </span>
              </p>
            </article>
          ))}
        </div>
      )}
    </section>

    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Opener timeline (first 45s)</h3>
      {!review.evidence.execution.openerEvents.length ? (
        <p className="mt-2 text-sm text-slate-300">No opener events detected from available data.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm text-slate-300">
          {review.evidence.execution.openerEvents.map((event, index) => (
            <li key={`${event.timestampRelativeMs}-${event.abilityName}-${index}`}>
              {PlayersMapper.formatRelativeTimestamp(event.timestampRelativeMs)} · {PlayersMapper.formatEventLine(event)}
            </li>
          ))}
        </ul>
      )}
    </section>

    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Casts / activity</h3>
      <p className="mt-2 text-sm text-slate-300">
        Cast count: <span className="text-slate-100">{review.evidence.execution.castCount}</span> · Casts/min:{' '}
        <span className="text-slate-100">{review.evidence.execution.castsPerMinute}</span>
      </p>
      <p className="mt-1 text-sm text-slate-300">
        Long no-cast gaps ({'>'}=10s):{' '}
        <span className="text-slate-100">
          {review.evidence.execution.longNoCastGapsMs.length
            ? review.evidence.execution.longNoCastGapsMs.map((gap) => `${Math.round(gap / 1000)}s`).join(', ')
            : 'None detected'}
        </span>
      </p>
    </section>

    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Cooldowns / consumables / defensives</h3>
      <p className="mt-2 text-sm text-slate-300">
        Recognized defensive events: <span className="text-slate-100">{review.evidence.survivability.defensiveEvents.length}</span>
      </p>
      <p className="mt-1 text-sm text-slate-300">
        Recognized consumable events: <span className="text-slate-100">{review.evidence.survivability.consumableEvents.length}</span>
      </p>
    </section>

    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Utility events</h3>
      <p className="mt-2 text-sm text-slate-300">
        Interrupts: <span className="text-slate-100">{review.evidence.utility.interrupts.length}</span> · Dispels:{' '}
        <span className="text-slate-100">{review.evidence.utility.dispels.length}</span>
      </p>
    </section>

    <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Confidence / limitations</h3>
      <p className="mt-2 text-sm text-slate-300">{review.source.note}</p>
      {review.source.limitations.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-400">
          {review.source.limitations.map((limitation, index) => (
            <li key={`${limitation}-${index}`}>{limitation}</li>
          ))}
        </ul>
      ) : null}
    </section>
  </section>
)
