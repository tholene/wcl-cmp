import type { FC } from 'react'
import { ReportListCard } from './report-list-card'
import type { ReportSummary } from '../types/report-summary'

type ReportsDashboardProps = {
  guildId?: string
  region?: string
  reports: ReportSummary[]
}

export const ReportsDashboard: FC<ReportsDashboardProps> = ({ guildId, region, reports }) => (
  <section className="space-y-5">
    <header className="rounded-xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-sm uppercase tracking-wide text-slate-400">Warcraft Logs Analyzer</p>
      <h1 className="mt-1 text-2xl font-semibold text-slate-100">Guild Report Dashboard</h1>
      <p className="mt-2 text-sm text-slate-300">
        Guild ID: <span className="text-slate-100">{guildId ?? 'Not configured'}</span>
        {' · '}
        Region: <span className="text-slate-100">{region ?? 'Not configured'}</span>
      </p>
    </header>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reports.map((report) => (
        <ReportListCard key={report.code} report={report} />
      ))}
    </div>
  </section>
)
