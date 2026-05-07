import type { FC } from 'react'
import { ReportsDashboard } from '../components/reports-dashboard'
import { useRecentReports } from '../hooks/use-recent-reports'

export const ReportsDashboardContainer: FC = () => {
  const recentReportsQuery = useRecentReports()

  if (recentReportsQuery.isPending) {
    return <p className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">Loading recent reports...</p>
  }

  if (recentReportsQuery.error) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        <p className="font-medium">Could not load reports.</p>
        <p className="mt-1 text-rose-100">{recentReportsQuery.error.message}</p>
      </div>
    )
  }

  const reportsPayload = recentReportsQuery.data

  if (!reportsPayload.reports.length) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">
        No recent reports found for this guild yet.
      </div>
    )
  }

  return (
    <ReportsDashboard
      guildId={reportsPayload.guildId}
      region={reportsPayload.region}
      reports={reportsPayload.reports}
    />
  )
}
