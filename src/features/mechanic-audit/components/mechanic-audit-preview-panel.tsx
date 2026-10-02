import type { FC } from 'react'
import { getDifficultyLabel } from '@/lib/difficulty'
import type { MechanicAuditPreviewResponse } from '../types/mechanic-audit.types'
import { S } from './mechanic-audit-styles'

type MechanicAuditPreviewPanelProps = {
  preview: MechanicAuditPreviewResponse
}

export const MechanicAuditPreviewPanel: FC<MechanicAuditPreviewPanelProps> = ({ preview }) => {
  const unobservedMechanics = preview.mechanics.filter((m) => m.observedInSample === false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <StatBox label="Reports matched" value={`${preview.reportsMatched} / ${preview.reportsScanned}`} />
        <StatBox label="Fights matched" value={`${preview.fightsMatched} / ${preview.fightsScanned}`} />
        <StatBox label="Estimated pulls" value={String(preview.estimatedPullCount)} />
      </div>

      <div style={{ fontSize: 12, color: S.textMuted }}>
        {getDifficultyLabel(preview.difficulty)} {preview.encounter.encounterName ?? `encounter ${preview.encounter.encounterId}`}
        {preview.raidDateRange.earliest && preview.raidDateRange.latest && (
          <> · {preview.raidDateRange.earliest} → {preview.raidDateRange.latest}</>
        )}
      </div>

      <div>
        <div style={{ fontSize: 11, color: S.textDim, marginBottom: 6 }}>Mechanics</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {preview.mechanics.map((m) => (
            <div
              key={m.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 6,
                background: m.observedInSample === false ? 'rgba(240,178,50,0.06)' : 'rgba(43,45,49,0.5)',
                border: `1px solid ${m.observedInSample === false ? 'rgba(240,178,50,0.20)' : S.border}`,
              }}
            >
              <span style={{ color: S.text }}>{m.label}</span>
              <span style={{ color: S.textFaint }}>{m.abilityIds.join(', ')}</span>
            </div>
          ))}
        </div>
      </div>

      {unobservedMechanics.length > 0 && (
        <div style={{ fontSize: 12, color: S.warning, padding: '8px 12px', borderRadius: 8, background: 'rgba(240,178,50,0.06)', border: '1px solid rgba(240,178,50,0.20)' }}>
          No sample hits found for: {unobservedMechanics.map((m) => m.label).join(', ')}. Double-check the ability IDs before exporting.
        </div>
      )}

      {preview.estimatedPullCount === 0 && (
        <div style={{ fontSize: 12, color: S.danger, padding: '8px 12px', borderRadius: 8, background: 'rgba(218,55,60,0.08)', border: '1px solid rgba(218,55,60,0.20)' }}>
          No matching pulls found for this scope and encounter. Check the encounter ID, difficulty, and date range.
        </div>
      )}

      {preview.warnings.length > 0 && (
        <details className="rounded border border-amber-700/30 bg-amber-950/10 p-2">
          <summary className="cursor-pointer text-xs text-amber-400">
            {preview.warnings.length} warning{preview.warnings.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
            {preview.warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-300">
                {w}
              </p>
            ))}
          </div>
        </details>
      )}
    </div>
  )
}

const StatBox: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ flex: '1 0 120px', padding: '10px 12px', borderRadius: 8, background: 'rgba(43,45,49,0.5)', border: `1px solid ${S.border}` }}>
    <div style={{ fontSize: 10, color: S.textDim, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 16, fontWeight: 700, color: S.text }}>{value}</div>
  </div>
)
