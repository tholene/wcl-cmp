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

type PlayerAnalysisExportResultsProps = {
  job: PlayerAnalysisExportJob
  exportId: string
  onReset: () => void
}

export const PlayerAnalysisExportResults: FC<PlayerAnalysisExportResultsProps> = ({ job, exportId, onReset }) => {
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

  const hasWarnings =
    topReasons.length > 0 || failedChecks.length > 0 || skippedCandidates.length > 0 ||
    skippedViews.length > 0 || truncatedViews.length > 0 || job.warnings.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Success / partial / failed banner */}
      {(job.status === 'complete' || job.status === 'partial') && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 10,
          background: 'rgba(35,165,90,0.04)', border: '1px solid rgba(35,165,90,0.13)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'rgba(35,165,90,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#23a55a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5' }}>
              {job.status === 'complete' ? 'Export complete' : 'Export completed with partial data'}
            </div>
            <div style={{ fontSize: 12, color: '#949ba4' }}>
              {summary?.nextStepInstruction ?? 'Upload this ZIP to ChatGPT or Claude for analysis'}
            </div>
          </div>
        </div>
      )}

      {job.status === 'failed' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 10,
          background: 'rgba(218,55,60,0.06)', border: '1px solid rgba(218,55,60,0.20)',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5' }}>Export failed</div>
            {resultSummary?.failedStep && <div style={{ fontSize: 12, color: '#949ba4' }}>Failed at: {resultSummary.failedStep}</div>}
            {resultSummary?.recoverySuggestion && <div style={{ fontSize: 12, color: '#f0b232' }}>Recovery: {resultSummary.recoverySuggestion}</div>}
          </div>
        </div>
      )}

      {/* Download ZIP — primary action */}
      {zipFile && (
        <DownloadButton href={downloadUrl(zipFile.filename)} filename={zipFile.filename} size={zipFile.sizeBytes} />
      )}

      {/* Partial top reasons */}
      {job.status === 'partial' && topReasons.length > 0 && (
        <div style={{ fontSize: 12, color: '#f0b232', padding: '8px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.20)' }}>
          {topReasons.map((r, i) => <p key={i}>{r}</p>)}
        </div>
      )}

      {/* Export summary */}
      <details className="rounded border border-white/[0.06] bg-[rgba(43,45,49,0.5)] p-2">
        <summary className="cursor-pointer text-xs font-medium text-slate-400">Export summary</summary>
        <div className="mt-2 text-xs text-slate-300 space-y-1">
          <p>Player: <span className="text-slate-100">{summary?.playerName ?? 'unknown'}</span></p>
          <p>Boss: <span className="text-slate-100">{summary?.encounterName ?? 'unknown'}</span></p>
          <p>Difficulty: <span className="text-slate-100">{summary?.difficultyLabel ?? getDifficultyLabel(summary?.difficulty ?? null)}</span></p>
          <p>Benchmark: <span className="text-slate-100">{summary?.benchmarkPlayerName ?? 'not included'}</span></p>
          {summary?.benchmarkPercentile != null && (
            <p>Target: <span className="text-slate-100">{summary.benchmarkPercentile}% {summary.benchmarkMetric ?? 'metric'}</span></p>
          )}
        </div>
      </details>

      {/* Detailed warnings */}
      {hasWarnings && (
        <details className="rounded border border-amber-700/20 bg-amber-950/10 p-2">
          <summary className="cursor-pointer text-xs font-medium text-amber-400">Detailed warnings</summary>
          <div className="mt-2 space-y-1 text-xs text-slate-300 max-h-48 overflow-y-auto">
            {failedChecks.map((check) => (
              <p key={check.code}>Check failed: {check.label}{check.reason ? ` — ${check.reason}` : ''}</p>
            ))}
            {skippedCandidates.map((c, i) => (
              <p key={i}>Benchmark skipped: {c.benchmarkPlayerName ?? 'unknown'} ({c.benchmarkReportCode ?? 'n/a'}#{c.benchmarkFightId ?? 'n/a'}) — {c.reason}</p>
            ))}
            {skippedViews.map((e, i) => (
              <p key={i}>Skipped: {e.subjectType} {e.view} ({e.reportCode ?? 'n/a'}#{e.fightId ?? 'n/a'}) — {e.reason}</p>
            ))}
            {truncatedViews.map((e, i) => (
              <p key={i}>Truncated: {e.subjectType} {e.view} ({e.reportCode}#{e.fightId}) capped at {e.rowLimit} rows.</p>
            ))}
            {job.warnings.map((w, i) => <p key={i}>Warning: {w}</p>)}
          </div>
        </details>
      )}

      {/* Individual files */}
      {otherFiles.length > 0 && (
        <details className="rounded border border-white/[0.06] bg-[rgba(43,45,49,0.5)] p-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-400">Individual files ({otherFiles.length})</summary>
          <div className="mt-2 space-y-1">
            {otherFiles.map((file) => (
              <a
                key={file.filename}
                href={downloadUrl(file.filename)}
                download={file.filename}
                className="flex items-center justify-between rounded border border-white/[0.06] bg-[rgba(26,27,30,0.7)] px-3 py-1.5 text-xs text-slate-300 hover:bg-[rgba(43,45,49,0.9)]"
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

      {/* Start over */}
      <button
        type="button"
        onClick={onReset}
        style={{
          width: '100%', padding: '8px 14px', borderRadius: 8,
          background: 'none', border: '1px solid rgba(255,255,255,0.08)',
          color: '#949ba4', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        Start over
      </button>
    </div>
  )
}

const DownloadButton: FC<{ href: string; filename: string; size: number }> = ({ href, filename, size }) => (
  <a
    href={href}
    download={filename}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      width: '100%',
      padding: '13px 20px',
      borderRadius: 10,
      background: 'linear-gradient(135deg, #23a55a, #1e9650)',
      border: 'none',
      color: '#fff',
      fontSize: 14,
      fontWeight: 700,
      textDecoration: 'none',
      boxShadow: '0 4px 16px rgba(35,165,90,0.30)',
      fontFamily: 'inherit',
    }}
  >
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2v8.5M4.5 7.5 8 11l3.5-3.5M3 13h10" />
    </svg>
    Download bundle.zip
    <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>{formatBytes(size)}</span>
  </a>
)
