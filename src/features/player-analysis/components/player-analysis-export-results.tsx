import type { FC } from 'react'
import { getDifficultyLabel } from '@/lib/difficulty'
import type { PlayerAnalysisExportFile, PlayerAnalysisExportJob } from '../types/player-analysis.types'

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const kindLabel: Record<PlayerAnalysisExportFile['kind'], string> = {
  zip: 'ZIP bundle',
  csv: 'CSV',
  json: 'JSON',
  manifest: 'Manifest',
  readme: 'README',
  benchmarkCsv: 'Benchmark CSV',
  benchmarkJson: 'Benchmark JSON',
}

type Props = {
  job: PlayerAnalysisExportJob
  exportId: string
  onReset: () => void
}

export const PlayerAnalysisExportResults: FC<Props> = ({ job, exportId, onReset }) => {
  const files = job.files ?? []
  const zipFile = files.find((f) => f.kind === 'zip')
  const otherFiles = files.filter((f) => f.kind !== 'zip')
  const skippedViews = job.viewSummary?.skippedViews ?? []
  const truncatedViews = job.viewSummary?.truncatedViews ?? []
  const skippedCandidates = job.benchmarkSummary?.skippedCandidates ?? []
  const resultSummary = job.resultSummary
  const summary = resultSummary?.summary
  const failedChecks = (resultSummary?.qualityChecks ?? []).filter((check) => !check.passed)
  const topReasons = resultSummary?.topReasons?.slice(0, 5) ?? []

  const downloadUrl = (filename: string) => `/api/player-analysis/exports/${exportId}/${filename}`

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Ready for ChatGPT</h2>
        {job.status === 'complete' && (
          <span className="rounded px-2 py-0.5 text-xs font-medium bg-emerald-900/40 text-emerald-300">complete</span>
        )}
        {job.status === 'partial' && (
          <span className="rounded px-2 py-0.5 text-xs font-medium bg-amber-900/40 text-amber-300">partial</span>
        )}
        {job.status === 'failed' && (
          <span className="rounded px-2 py-0.5 text-xs font-medium bg-rose-900/40 text-rose-300">failed</span>
        )}
      </div>

      <div className="rounded border border-slate-700 bg-slate-950/40 p-3 text-xs text-slate-300 space-y-1">
        <p>Player: <span className="text-slate-100">{summary?.playerName ?? 'unknown'}</span></p>
        <p>Boss: <span className="text-slate-100">{summary?.encounterName ?? 'unknown'}</span></p>
        <p>
          Difficulty: <span className="text-slate-100">{summary?.difficultyLabel ?? getDifficultyLabel(summary?.difficulty ?? null)}</span>
        </p>
        <p>Benchmark player: <span className="text-slate-100">{summary?.benchmarkPlayerName ?? 'not included'}</span></p>
        <p>
          Benchmark target:{' '}
          <span className="text-slate-100">
            {summary?.benchmarkPercentile != null
              ? `${summary.benchmarkPercentile}% ${summary.benchmarkMetric ?? 'metric'}`
              : 'n/a'}
          </span>
        </p>
        <p>Status: <span className="text-slate-100">{job.status}</span></p>
      </div>

      {zipFile && (
        <a
          href={downloadUrl(zipFile.filename)}
          download={zipFile.filename}
          className="flex items-center justify-between w-full rounded border border-violet-600 bg-violet-700/20 px-4 py-2.5 text-sm font-medium text-violet-200 hover:bg-violet-700/30"
        >
          <span>Download bundle.zip</span>
          <span className="text-xs text-violet-300/70">{formatBytes(zipFile.sizeBytes)}</span>
        </a>
      )}

      {(job.status === 'complete' || job.status === 'partial') && (
        <div className="rounded border border-emerald-700/30 bg-emerald-950/20 p-2 text-xs text-emerald-200">
          {summary?.nextStepInstruction ?? 'Upload this ZIP to ChatGPT. The README contains the analysis instructions.'}
        </div>
      )}

      {job.status === 'partial' && (
        <div className="rounded border border-amber-700/30 bg-amber-950/20 p-2 text-xs text-amber-200 space-y-1">
          <p className="font-medium">Export completed with partial data</p>
          {topReasons.length > 0 ? topReasons.map((reason, index) => <p key={`reason-${index}`}>{reason}</p>) : <p>Some requested data could not be exported.</p>}
        </div>
      )}

      {job.status === 'failed' && (
        <div className="rounded border border-rose-700/40 bg-rose-950/20 p-2 text-xs text-rose-200 space-y-1">
          <p className="font-medium">Export failed</p>
          {resultSummary?.failedStep && <p>Failed step: {resultSummary.failedStep}</p>}
          {resultSummary?.recoverySuggestion && <p>Recovery: {resultSummary.recoverySuggestion}</p>}
          {topReasons.length > 0 && <p>{topReasons[0]}</p>}
        </div>
      )}

      {(topReasons.length > 0 || failedChecks.length > 0 || skippedCandidates.length > 0 || skippedViews.length > 0 || truncatedViews.length > 0 || job.warnings.length > 0) && (
        <details className="rounded border border-slate-700 bg-slate-950/40 p-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-400">Detailed warnings</summary>
          <div className="mt-2 space-y-1 text-xs text-slate-300 max-h-48 overflow-y-auto">
            {failedChecks.map((check) => (
              <p key={check.code}>Check failed: {check.label}{check.reason ? ` — ${check.reason}` : ''}</p>
            ))}
            {skippedCandidates.map((candidate, index) => (
              <p key={`candidate-${index}`}>
                Benchmark skipped: {candidate.benchmarkPlayerName ?? 'unknown player'} ({candidate.benchmarkReportCode ?? 'n/a'}#{candidate.benchmarkFightId ?? 'n/a'}) — {candidate.reason}
              </p>
            ))}
            {skippedViews.map((entry, index) => (
              <p key={`skip-${index}`}>
                Skipped view: {entry.subjectType} {entry.view} ({entry.reportCode ?? 'n/a'}#{entry.fightId ?? 'n/a'}) — {entry.reason}
              </p>
            ))}
            {truncatedViews.map((entry, index) => (
              <p key={`truncated-${index}`}>
                Truncated view: {entry.subjectType} {entry.view} ({entry.reportCode}#{entry.fightId}) capped at {entry.rowLimit} rows.
              </p>
            ))}
            {job.warnings.map((warning, index) => (
              <p key={`warning-${index}`}>Warning: {warning}</p>
            ))}
          </div>
        </details>
      )}

      {otherFiles.length > 0 && (
        <details className="rounded border border-slate-700 bg-slate-950/40 p-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-400">Individual files ({otherFiles.length})</summary>
          <div className="mt-2 space-y-1">
            {otherFiles.map((file) => (
              <a
                key={file.filename}
                href={downloadUrl(file.filename)}
                download={file.filename}
                className="flex items-center justify-between rounded border border-slate-700 bg-slate-950/50 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600 hover:bg-slate-900"
              >
                <span className="truncate mr-2">
                  <span className="text-slate-500">[{kindLabel[file.kind]}]</span> {file.filename}
                  {file.rowCount !== undefined && <span className="ml-1 text-slate-500">({file.rowCount.toLocaleString()} rows)</span>}
                </span>
                <span className="shrink-0 text-slate-500">{formatBytes(file.sizeBytes)}</span>
              </a>
            ))}
          </div>
        </details>
      )}

      <button
        type="button"
        onClick={onReset}
        className="w-full rounded border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
      >
        Start new export
      </button>
    </div>
  )
}
