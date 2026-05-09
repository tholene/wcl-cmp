import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { StatusPill } from '@/components/ui/status-pill'
import { getFightReviewPath, PATHS } from '@/lib/routes'
import { ReportsMapper } from '../mappers/reports.mapper'
import type { ReportDetails } from '../types/report-details'

type ReportDetailsPanelProps = {
  report: ReportDetails
}

export const ReportDetailsPanel: FC<ReportDetailsPanelProps> = ({ report }) => (
  <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold text-slate-100">{report.title}</h2>
        <p className="mt-1 text-sm text-slate-400">
          {report.zoneName ?? 'Unknown zone'} · {ReportsMapper.formatReportDate(report)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <a
          href={report.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
        >
          Open in WCL
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <Link
          to={PATHS.HOME}
          className="inline-flex rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
        >
          Back
        </Link>
      </div>
    </div>

    <div className="mb-4 grid gap-3 md:grid-cols-3">
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
        <p className="text-slate-400">Owner</p>
        <p className="mt-1 font-medium text-slate-100">{report.ownerName ?? 'Unknown'}</p>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
        <p className="text-slate-400">Visibility</p>
        <p className="mt-1 font-medium text-slate-100">{report.visibility ?? 'Unknown'}</p>
      </div>
      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 text-sm">
        <p className="text-slate-400">Fight count</p>
        <p className="mt-1 font-medium text-slate-100">{report.fights.length}</p>
      </div>
    </div>

    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800 text-sm">
        <thead className="bg-slate-900/50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-300">Encounter</th>
            <th className="px-3 py-2 text-left font-medium text-slate-300">Result</th>
            <th className="px-3 py-2 text-left font-medium text-slate-300">Difficulty</th>
            <th className="px-3 py-2 text-left font-medium text-slate-300">Duration</th>
            <th className="px-3 py-2 text-left font-medium text-slate-300">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-950/30">
          {report.fights.map((fight) => (
            <tr key={fight.id}>
              <td className="px-3 py-2 text-slate-100">{fight.encounterName}</td>
              <td className="px-3 py-2">
                <StatusPill text={fight.kill ? 'Kill' : 'Wipe'} tone={fight.kill ? 'success' : 'danger'} />
              </td>
              <td className="px-3 py-2 text-slate-300">{fight.difficulty}</td>
              <td className="px-3 py-2 text-slate-300">{ReportsMapper.formatFightDuration(fight)}</td>
              <td className="px-3 py-2">
                <Link
                  to={getFightReviewPath(report.code, fight.id)}
                  className="inline-flex rounded-md border border-violet-500/40 px-2.5 py-1 text-xs text-violet-200 hover:bg-violet-500/10"
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)
