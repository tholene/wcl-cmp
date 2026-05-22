import type { FC } from 'react'
import type { PlayerAnalysisExportJob } from '../types/player-analysis.types'

type PlayerAnalysisExportProgressProps = {
  job: PlayerAnalysisExportJob
}

export const PlayerAnalysisExportProgress: FC<PlayerAnalysisExportProgressProps> = ({ job }) => {
  const isTerminal = job.status === 'complete' || job.status === 'partial' || job.status === 'failed'
  const groupedWarnings = Object.entries(job.warningGroups ?? {})
  const errors = job.errors ?? []

  const barColor =
    job.status === 'failed' ? '#da373c' :
    job.status === 'complete' ? '#23a55a' :
    '#5865f2'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Status + percentage row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: '#b5bac1' }}>
          {job.currentStep ?? (job.status === 'complete' ? 'Export complete' : job.status === 'failed' ? 'Export failed' : 'Exporting…')}
        </span>
        <span style={{ fontSize: 12, color: '#6d6f78', fontVariantNumeric: 'tabular-nums' }}>
          {job.percentComplete}%
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, borderRadius: 3, backgroundColor: '#2b2d31', overflow: 'hidden' }}>
        <div style={{
          width: `${Math.min(job.percentComplete ?? 0, 100)}%`,
          height: '100%',
          borderRadius: 3,
          backgroundColor: barColor,
          boxShadow: `0 0 8px ${barColor}50`,
          transition: 'width 0.5s ease',
        }} />
      </div>

      {/* Step counter */}
      <div style={{ fontSize: 11, color: '#6d6f78' }}>
        {job.completedSteps} / {job.totalSteps} steps
      </div>

      {/* Benchmark summary */}
      {job.benchmarkSummary && (
        <div style={{ fontSize: 12, color: '#949ba4', padding: '8px 12px', borderRadius: 8, background: 'rgba(43,45,49,0.72)', border: '1px solid rgba(255,255,255,0.06)' }}>
          Benchmark: {job.benchmarkSummary.exportedCount}/{job.benchmarkSummary.selectedCount} exported
          {job.benchmarkSummary.skippedCount > 0 && `, ${job.benchmarkSummary.skippedCount} skipped`}
        </div>
      )}

      {/* Partial data warning */}
      {job.status === 'partial' && (
        <div style={{ fontSize: 12, color: '#f0b232', padding: '8px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.20)' }}>
          Some data could not be exported.
        </div>
      )}

      {/* Warnings (collapsed) */}
      {job.warnings.length > 0 && (
        <details className="rounded border border-amber-700/30 bg-amber-950/10 p-2">
          <summary className="cursor-pointer text-xs text-amber-400">{job.warnings.length} warning{job.warnings.length !== 1 ? 's' : ''}</summary>
          <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
            {job.warnings.map((w, i) => <p key={i} className="text-xs text-amber-300">{w}</p>)}
          </div>
        </details>
      )}

      {groupedWarnings.length > 0 && !isTerminal && (
        <div style={{ fontSize: 11, color: '#6d6f78' }}>
          {groupedWarnings.map(([group, warnings]) => `${group}: ${warnings.length}`).join(' · ')}
        </div>
      )}

      {/* Errors */}
      {(job.status === 'failed' || errors.length > 0) && (
        <div style={{ fontSize: 12, color: '#f38ba8', padding: '10px 12px', borderRadius: 8, background: 'rgba(218,55,60,0.08)', border: '1px solid rgba(218,55,60,0.20)' }}>
          {job.error && <p>{job.error}</p>}
          {errors.map((e, i) => <p key={i}>{e}</p>)}
        </div>
      )}
    </div>
  )
}
