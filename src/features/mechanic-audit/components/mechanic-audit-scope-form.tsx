import type { FC } from 'react'
import { getDifficultyLabel } from '@/lib/difficulty'
import { inputStyle, labelStyle, S, selectStyle } from './mechanic-audit-styles'

type MechanicAuditScopeFormProps = {
  scopeMode: 'dateRange' | 'manualReports'
  since: string
  until: string
  reportCodesText: string
  encounterId: string
  encounterName: string
  difficulty: string
  timezone: string
  onScopeModeChange: (value: 'dateRange' | 'manualReports') => void
  onSinceChange: (value: string) => void
  onUntilChange: (value: string) => void
  onReportCodesTextChange: (value: string) => void
  onEncounterIdChange: (value: string) => void
  onEncounterNameChange: (value: string) => void
  onDifficultyChange: (value: string) => void
  onTimezoneChange: (value: string) => void
}

const DIFFICULTY_OPTIONS = [3, 4, 5]

export const MechanicAuditScopeForm: FC<MechanicAuditScopeFormProps> = ({
  scopeMode,
  since,
  until,
  reportCodesText,
  encounterId,
  encounterName,
  difficulty,
  timezone,
  onScopeModeChange,
  onSinceChange,
  onUntilChange,
  onReportCodesTextChange,
  onEncounterIdChange,
  onEncounterNameChange,
  onDifficultyChange,
  onTimezoneChange,
}) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={labelStyle}>Scope</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={() => onScopeModeChange('dateRange')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${scopeMode === 'dateRange' ? S.accent : S.border}`,
              background: scopeMode === 'dateRange' ? 'rgba(88,101,242,0.12)' : 'transparent',
              color: scopeMode === 'dateRange' ? S.text : S.textFaint,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Date range
          </button>
          <button
            type="button"
            onClick={() => onScopeModeChange('manualReports')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 8,
              border: `1px solid ${scopeMode === 'manualReports' ? S.accent : S.border}`,
              background: scopeMode === 'manualReports' ? 'rgba(88,101,242,0.12)' : 'transparent',
              color: scopeMode === 'manualReports' ? S.text : S.textFaint,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Manual report codes
          </button>
        </div>
      </div>

      {scopeMode === 'dateRange' ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Since</label>
            <input type="date" style={inputStyle} value={since} onChange={(e) => onSinceChange(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Until</label>
            <input type="date" style={inputStyle} value={until} onChange={(e) => onUntilChange(e.target.value)} />
          </div>
        </div>
      ) : (
        <div>
          <label style={labelStyle}>Report codes (comma, space, or newline separated)</label>
          <textarea
            style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
            value={reportCodesText}
            onChange={(e) => onReportCodesTextChange(e.target.value)}
            placeholder="AbC123XyZ, DeF456UvW"
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Encounter ID (verified)</label>
          <input
            type="number"
            style={inputStyle}
            value={encounterId}
            onChange={(e) => onEncounterIdChange(e.target.value)}
            placeholder="e.g. 3010"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Difficulty</label>
          <select style={selectStyle} value={difficulty} onChange={(e) => onDifficultyChange(e.target.value)}>
            {DIFFICULTY_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {getDifficultyLabel(d)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label style={labelStyle}>Encounter name (optional, display only)</label>
        <input
          style={inputStyle}
          value={encounterName}
          onChange={(e) => onEncounterNameChange(e.target.value)}
          placeholder="L'ura, the Waking Storm"
        />
      </div>

      <div>
        <label style={labelStyle}>Raid-night timezone</label>
        <input style={inputStyle} value={timezone} onChange={(e) => onTimezoneChange(e.target.value)} placeholder="Europe/Stockholm" />
      </div>
    </div>
  )
