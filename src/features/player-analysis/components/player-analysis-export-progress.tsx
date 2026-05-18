import type { FC } from 'react'
import type { PlayerAnalysisExportJob } from '../types/player-analysis.types'

type Props = {
  job: PlayerAnalysisExportJob
}

export const PlayerAnalysisExportProgress: FC<Props> = ({ job }) => {
  const isTerminal = job.status === 'complete' || job.status === 'partial' || job.status === 'failed'
  const skippedViews = job.viewSummary?.skippedViews ?? []
  const truncatedViews = job.viewSummary?.truncatedViews ?? []
  const benchmarkSkipped = job.benchmarkSummary?.skippedCandidates ?? []
  const groupedWarnings = Object.entries(job.warningGroups ?? {})
  const errors = job.errors ?? []
  const statusLabel =
    job.status === 'partial'
      ? 'Export completed with partial data'
      : job.status === 'complete'
        ? 'Export complete'
        : job.status === 'failed'
          ? 'Export failed'
          : job.status

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Export Progress</h2>
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${
          job.status === 'complete' ? 'bg-emerald-900/40 text-emerald-300' :
          job.status === 'partial' ? 'bg-amber-900/40 text-amber-300' :
          job.status === 'failed' ? 'bg-rose-900/40 text-rose-300' :
          'bg-slate-800 text-slate-400'
        }`}>
          {statusLabel}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-400">
          <span>{job.currentStep}</span>
          <span>{job.percentComplete}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              job.status === 'failed' ? 'bg-rose-600' :
              job.status === 'complete' ? 'bg-emerald-600' :
              'bg-violet-600'
            }`}
            style={{ width: `${job.percentComplete}%` }}
          />
        </div>
        <div className="text-xs text-slate-500">
          {job.completedSteps} / {job.totalSteps} steps
        </div>
      </div>

      {(job.currentReportCode || job.currentFightId) && !isTerminal && (
        <div className="text-xs text-slate-400">
          {job.currentReportCode && <span>Report: {job.currentReportCode}</span>}
          {job.currentFightId && <span className="ml-2">Fight: {job.currentFightId}</span>}
        </div>
      )}

      {job.status === 'partial' && (skippedViews.length > 0 || truncatedViews.length > 0 || benchmarkSkipped.length > 0) && (
        <div className="rounded border border-amber-700/30 bg-amber-950/20 p-2 space-y-1 text-xs text-amber-200">
          {skippedViews.length > 0 && (
            <p>Skipped view outcomes: {skippedViews.length}</p>
          )}
          {truncatedViews.length > 0 && (
            <p>Truncated view outcomes: {truncatedViews.length}</p>
          )}
          {benchmarkSkipped.length > 0 && (
            <p>Skipped benchmark candidates: {benchmarkSkipped.length}</p>
          )}
        </div>
      )}

      {job.warnings.length > 0 && (
        <div className="rounded border border-amber-700/30 bg-amber-950/20 p-2 space-y-1 text-xs text-amber-200 max-h-32 overflow-y-auto">
          {job.warnings.map((w, i) => (
            <p key={i}>Warning: {w}</p>
          ))}
        </div>
      )}

      {groupedWarnings.length > 0 && (
        <div className="rounded border border-slate-700 bg-slate-950/40 p-2 space-y-1 text-xs text-slate-300 max-h-40 overflow-y-auto">
          {groupedWarnings.map(([group, warnings]) => (
            <p key={group}>
              {group}: {warnings.length}
            </p>
          ))}
        </div>
      )}

      {(job.status === 'failed' || errors.length > 0) && (
        <div className="rounded border border-rose-700/40 bg-rose-950/20 p-2 text-xs text-rose-200">
          <p className="font-medium">Failure details</p>
          {job.error && <p className="mt-1">{job.error}</p>}
          {errors.map((error, index) => (
            <p key={index} className="mt-1">{error}</p>
          ))}
        </div>
      )}
    </div>
  )
}
