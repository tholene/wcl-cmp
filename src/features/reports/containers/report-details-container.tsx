import type { FC } from 'react'
import { useParams } from 'react-router-dom'
import { ReportDetailsPanel } from '../components/report-details-panel'
import { useReportDetails } from '../hooks/use-report-details'

export const ReportDetailsContainer: FC = () => {
  const params = useParams()
  const reportCode = params.code
  const reportDetailsQuery = useReportDetails(reportCode)

  if (!reportCode) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        Missing report code in URL.
      </div>
    )
  }

  if (reportDetailsQuery.isPending) {
    return <p className="rounded-lg border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-300">Loading report details...</p>
  }

  if (reportDetailsQuery.error) {
    return (
      <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 p-4 text-sm text-rose-200">
        <p className="font-medium">Could not load report details.</p>
        <p className="mt-1 text-rose-100">{reportDetailsQuery.error.message}</p>
      </div>
    )
  }

  return <ReportDetailsPanel report={reportDetailsQuery.data} />
}
