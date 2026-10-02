import type { FC, ReactNode } from 'react'
import type { MechanicAuditThresholds } from '../types/mechanic-audit.types'
import { inputStyle, labelStyle, S } from './mechanic-audit-styles'

type MechanicAuditAdvancedSidebarProps = {
  open: boolean
  onClose: () => void
  thresholds: MechanicAuditThresholds
  onThresholdsChange: (value: Partial<MechanicAuditThresholds>) => void
}

export const MechanicAuditAdvancedSidebar: FC<MechanicAuditAdvancedSidebarProps> = ({
  open,
  onClose,
  thresholds,
  onThresholdsChange,
}) => {
  if (!open) return null

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          zIndex: 200,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          backgroundColor: S.bg2,
          borderLeft: `1px solid ${S.border}`,
          zIndex: 201,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
          animation: 'sideSlide 0.2s ease',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: `1px solid ${S.border}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>Review-candidate thresholds</span>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: `1px solid ${S.border}`,
              background: 'none',
              color: S.textFaint,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <SBSection title="Eligibility">
            <label style={labelStyle}>Minimum eligible pulls</label>
            <input
              type="number"
              style={inputStyle}
              value={thresholds.minimumEligiblePulls}
              onChange={(e) => onThresholdsChange({ minimumEligiblePulls: Number(e.target.value) })}
            />
            <label style={labelStyle}>Minimum raid nights with a failure</label>
            <input
              type="number"
              style={inputStyle}
              value={thresholds.minimumRaidNightsWithFailure}
              onChange={(e) => onThresholdsChange({ minimumRaidNightsWithFailure: Number(e.target.value) })}
            />
          </SBSection>

          <SBSection title="Concentration rule">
            <label style={labelStyle}>Guild average multiplier</label>
            <input
              type="number"
              step="0.1"
              style={inputStyle}
              value={thresholds.guildAverageMultiplier}
              onChange={(e) => onThresholdsChange({ guildAverageMultiplier: Number(e.target.value) })}
            />
            <label style={labelStyle}>Minimum absolute rate delta</label>
            <input
              type="number"
              step="0.01"
              style={inputStyle}
              value={thresholds.minimumAbsoluteRateDelta}
              onChange={(e) => onThresholdsChange({ minimumAbsoluteRateDelta: Number(e.target.value) })}
            />
          </SBSection>

          <p style={{ fontSize: 11, color: S.textDim }}>
            These thresholds decide who is flagged as a review candidate in the exported summary. They are evidence for
            officer review, not an automatic verdict.
          </p>
        </div>
      </div>
    </>
  )
}

const SBSection: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <div>
    <div style={{ fontSize: 10, fontWeight: 700, color: S.textDim, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
      {title}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
  </div>
)
