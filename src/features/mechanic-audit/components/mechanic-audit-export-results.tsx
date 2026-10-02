import type { FC } from 'react'
import { buildMechanicAuditDownloadUrl } from '../lib/mechanic-audit-export-download-url'
import type { MechanicAuditExportFile, MechanicAuditJob } from '../types/mechanic-audit.types'

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const filenameLabel = (file: MechanicAuditExportFile): string => {
  if (file.filename.endsWith('.zip')) return 'ZIP bundle'
  if (file.filename.endsWith('.csv')) return 'CSV'
  if (file.filename.endsWith('.json')) return 'JSON'
  if (file.filename.toLowerCase().includes('readme') || file.filename.toLowerCase().includes('summary')) return 'README'
  return 'File'
}

type MechanicAuditExportResultsProps = {
  job: MechanicAuditJob
  auditId: string
  onReset: () => void
}

export const MechanicAuditExportResults: FC<MechanicAuditExportResultsProps> = ({ job, auditId, onReset }) => {
  const files = job.files ?? []
  const zipFile = files.find((f) => f.filename.endsWith('.zip'))
  const otherFiles = files.filter((f) => f !== zipFile)
  const summary = job.resultSummary

  const downloadUrl = (filename: string) => buildMechanicAuditDownloadUrl(auditId, filename)

  const hasWarnings = (summary?.fightsExcluded.length ?? 0) > 0 || job.warnings.length > 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {(job.status === 'complete' || job.status === 'partial') && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 10,
            background: 'rgba(35,165,90,0.04)',
            border: '1px solid rgba(35,165,90,0.13)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(35,165,90,0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="#23a55a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5' }}>
              {job.status === 'complete' ? 'Export complete' : 'Export completed with partial data'}
            </div>
            <div style={{ fontSize: 12, color: '#949ba4' }}>Review the CSVs before sharing conclusions with the roster.</div>
          </div>
        </div>
      )}

      {job.status === 'failed' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderRadius: 10,
            background: 'rgba(218,55,60,0.06)',
            border: '1px solid rgba(218,55,60,0.20)',
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5' }}>Export failed</div>
            {job.error && <div style={{ fontSize: 12, color: '#949ba4' }}>{job.error}</div>}
          </div>
        </div>
      )}

      {zipFile && <DownloadButton href={downloadUrl(zipFile.filename)} filename={zipFile.filename} size={zipFile.sizeBytes} />}

      {summary && (
        <details className="rounded border border-white/[0.06] bg-[rgba(43,45,49,0.5)] p-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-400">Export summary</summary>
          <div className="mt-2 text-xs text-slate-300 space-y-1">
            <p>
              Reports: <span className="text-slate-100">{summary.reportsIncluded} / {summary.reportsScanned}</span>
            </p>
            <p>
              Fights: <span className="text-slate-100">{summary.fightsIncluded} / {summary.fightsScanned}</span>
            </p>
            <p>
              Events: <span className="text-slate-100">{summary.deduplicatedEventCount.toLocaleString()}</span> deduplicated from{' '}
              <span className="text-slate-100">{summary.rawEventCount.toLocaleString()}</span> raw
            </p>
            {summary.truncated && <p className="text-amber-400">Some data was truncated — see the manifest for details.</p>}
          </div>
        </details>
      )}

      {hasWarnings && (
        <details className="rounded border border-amber-700/20 bg-amber-950/10 p-2">
          <summary className="cursor-pointer text-xs font-medium text-amber-400">Detailed warnings</summary>
          <div className="mt-2 space-y-1 text-xs text-slate-300 max-h-48 overflow-y-auto">
            {(summary?.fightsExcluded ?? []).map((f, i) => (
              <p key={i}>
                Excluded: {f.reportCode}#{f.fightId} — {f.reason}
              </p>
            ))}
            {job.warnings.map((w, i) => (
              <p key={i}>Warning: {w}</p>
            ))}
          </div>
        </details>
      )}

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
                  <span className="text-slate-500">[{filenameLabel(file)}]</span> {file.filename}
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
        style={{
          width: '100%',
          padding: '8px 14px',
          borderRadius: 8,
          background: 'none',
          border: '1px solid rgba(255,255,255,0.08)',
          color: '#949ba4',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
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
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v8.5M4.5 7.5 8 11l3.5-3.5M3 13h10" />
    </svg>
    Download bundle.zip
    <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>{formatBytes(size)}</span>
  </a>
)
