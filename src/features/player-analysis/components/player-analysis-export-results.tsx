import type { FC } from 'react'
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

  const downloadUrl = (filename: string) => `/api/player-analysis/exports/${exportId}/${filename}`

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Export Ready</h2>
        {job.status === 'partial' && (
          <span className="rounded px-2 py-0.5 text-xs font-medium bg-amber-900/40 text-amber-300">partial</span>
        )}
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

      {otherFiles.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-slate-400">Individual files</p>
          <div className="space-y-1">
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
        </div>
      )}

      {job.warnings.length > 0 && (
        <div className="rounded border border-amber-700/30 bg-amber-950/20 p-2 space-y-1 text-xs text-amber-200 max-h-32 overflow-y-auto">
          <p className="font-medium text-amber-400">Warnings ({job.warnings.length})</p>
          {job.warnings.map((w, i) => (
            <p key={i}>⚠ {w}</p>
          ))}
        </div>
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
