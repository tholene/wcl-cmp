import type { FC } from 'react'
import type { MechanicAuditJob } from '../types/mechanic-audit.types'

type MechanicAuditExportProgressProps = {
  job: MechanicAuditJob
}

export const MechanicAuditExportProgress: FC<MechanicAuditExportProgressProps> = ({ job }) => {
  const errors = job.errors ?? []

  const barColor =
    job.status === 'failed' ? '#da373c' :
    job.status === 'complete' ? '#23a55a' :
    '#5865f2'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 13, color: '#b5bac1' }}>
          {job.currentStep ?? (job.status === 'complete' ? 'Export complete' : job.status === 'failed' ? 'Export failed' : 'Exporting…')}
        </span>
        <span style={{ fontSize: 12, color: '#6d6f78', fontVariantNumeric: 'tabular-nums' }}>{job.percentComplete}%</span>
      </div>

      <div style={{ height: 4, borderRadius: 3, backgroundColor: '#2b2d31', overflow: 'hidden' }}>
        <div
          style={{
            width: `${Math.min(job.percentComplete ?? 0, 100)}%`,
            height: '100%',
            borderRadius: 3,
            backgroundColor: barColor,
            boxShadow: `0 0 8px ${barColor}50`,
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      <div style={{ fontSize: 11, color: '#6d6f78' }}>
        {job.completedSteps} / {job.totalSteps} steps
      </div>

      {job.status === 'partial' && (
        <div style={{ fontSize: 12, color: '#f0b232', padding: '8px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.20)' }}>
          Some reports or fights could not be exported.
        </div>
      )}

      {job.warnings.length > 0 && (
        <details className="rounded border border-amber-700/30 bg-amber-950/10 p-2">
          <summary className="cursor-pointer text-xs text-amber-400">
            {job.warnings.length} warning{job.warnings.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
            {job.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-300">
                {w}
              </p>
            ))}
          </div>
        </details>
      )}

      {(job.status === 'failed' || errors.length > 0) && (
        <div style={{ fontSize: 12, color: '#f38ba8', padding: '10px 12px', borderRadius: 8, background: 'rgba(218,55,60,0.08)', border: '1px solid rgba(218,55,60,0.20)' }}>
          {job.error && <p>{job.error}</p>}
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}
    </div>
  )
}
