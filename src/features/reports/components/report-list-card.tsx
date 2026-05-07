import type { FC } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { getReportDetailsPath } from '@/lib/routes'
import { ReportsMapper } from '../mappers/reports.mapper'
import type { ReportSummary } from '../types/report-summary'

type ReportListCardProps = {
  report: ReportSummary
}

export const ReportListCard: FC<ReportListCardProps> = ({ report }) => (
  <article className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm transition hover:border-slate-700">
    <div className="mb-3 flex items-start justify-between gap-2">
      <h3 className="text-base font-semibold text-slate-100">{report.title}</h3>
      <a
        href={report.url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-violet-300 hover:text-violet-200"
      >
        Open WCL
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </div>

    <div className="space-y-1 text-sm text-slate-300">
      <p>
        <span className="text-slate-400">Zone:</span> {report.zoneName ?? 'Unknown'}
      </p>
      <p>
        <span className="text-slate-400">Owner:</span> {report.ownerName ?? 'Unknown'}
      </p>
      <p>
        <span className="text-slate-400">Started:</span> {ReportsMapper.formatReportDate(report)}
      </p>
      <p>
        <span className="text-slate-400">Duration:</span> {ReportsMapper.formatReportDuration(report)}
      </p>
    </div>

    <div className="mt-4">
      <Link
        to={getReportDetailsPath(report.code)}
        className="inline-flex rounded-md border border-violet-500/50 px-3 py-1.5 text-xs font-medium text-violet-200 hover:bg-violet-500/10"
      >
        View details
      </Link>
    </div>
  </article>
)
