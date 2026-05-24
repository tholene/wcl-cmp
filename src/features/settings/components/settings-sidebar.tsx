import { useState, type CSSProperties, type FC } from 'react'
import type { AppSettings, WclSite } from '@/features/settings/types/app-settings'

const S = {
  bg0: '#1a1b1e',
  bg2: '#2b2d31',
  text: '#f2f3f5',
  textMuted: '#b5bac1',
  textFaint: '#949ba4',
  textDim: '#6d6f78',
  border: 'rgba(255,255,255,0.06)',
  borderLight: 'rgba(255,255,255,0.10)',
  accent: '#5865f2',
}

type SettingsSidebarProps = {
  onClose: () => void
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  onClearAll: () => void
}

const SITE_OPTIONS: Array<{ value: WclSite; label: string }> = [
  { value: 'retail', label: 'Retail' },
  { value: 'classic', label: 'Classic' },
  { value: 'fresh', label: 'Fresh' },
]

export const SettingsSidebar: FC<SettingsSidebarProps> = ({
  onClose,
  settings,
  onSave,
  onClearAll,
}) => {
  const [draft, setDraft] = useState<AppSettings>(settings)

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          zIndex: 220,
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
          zIndex: 221,
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
          <span style={{ fontSize: 14, fontWeight: 700, color: S.text }}>Settings</span>
          <button
            type="button"
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

        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <section style={sectionStyle}>
            <h3 style={sectionTitleStyle}>Warcraft Logs</h3>

            <Label htmlFor="wcl-site">WCL site</Label>
            <div
              id="wcl-site"
              role="radiogroup"
              aria-label="WCL site"
              style={segmentedGroupStyle}
            >
              {SITE_OPTIONS.map((option) => {
                const selected = draft.wclSite === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setDraft((prev) => ({ ...prev, wclSite: option.value }))}
                    style={{
                      ...segmentedButtonStyle,
                      ...(selected ? segmentedButtonSelectedStyle : {}),
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>

            <Label htmlFor="guild-id">Guild ID (optional)</Label>
            <input
              id="guild-id"
              type="text"
              value={draft.guildId ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, guildId: e.target.value }))}
              placeholder="61324"
              style={inputStyle}
            />

            <Label htmlFor="region">Region (optional)</Label>
            <input
              id="region"
              type="text"
              value={draft.region ?? ''}
              onChange={(e) => setDraft((prev) => ({ ...prev, region: e.target.value }))}
              placeholder="EU"
              style={inputStyle}
            />

            <p style={{ margin: 0, fontSize: 11, color: S.textDim }}>
              Settings are stored locally in this browser. API credentials are never stored here.
            </p>
          </section>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: 16,
            borderTop: `1px solid ${S.border}`,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => setDraft((prev) => ({ ...prev, guildId: null, region: null }))}
            style={secondaryButtonStyle}
          >
            Clear optional fields
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
            style={primaryButtonStyle}
          >
            Save
          </button>
        </div>

        <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => {
              onClearAll()
              setDraft({
                wclSite: null,
                guildId: null,
                region: null,
              })
            }}
            style={ghostButtonStyle}
          >
            Reset all settings
          </button>
        </div>
      </div>
    </>
  )
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 10,
  border: `1px solid ${S.border}`,
  background: S.bg0,
}

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 700,
  color: S.textMuted,
  letterSpacing: 0.3,
}

const Label: FC<{ htmlFor: string; children: string }> = ({ htmlFor, children }) => (
  <label htmlFor={htmlFor} style={{ marginTop: 4, fontSize: 12, color: S.textFaint }}>
    {children}
  </label>
)

const baseFieldStyle: CSSProperties = {
  width: '100%',
  borderRadius: 8,
  border: `1px solid ${S.borderLight}`,
  background: 'rgba(255,255,255,0.02)',
  color: S.text,
  padding: '8px 10px',
  outline: 'none',
  fontSize: 12,
  fontFamily: 'inherit',
}

const inputStyle: CSSProperties = baseFieldStyle

const segmentedGroupStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: 4,
  borderRadius: 10,
  border: `1px solid ${S.borderLight}`,
  background: 'rgba(255,255,255,0.02)',
}

const segmentedButtonStyle: CSSProperties = {
  flex: 1,
  borderRadius: 8,
  border: `1px solid transparent`,
  background: 'transparent',
  color: S.textFaint,
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'all 0.12s',
}

const segmentedButtonSelectedStyle: CSSProperties = {
  border: `1px solid rgba(88,101,242,0.45)`,
  background: 'rgba(88,101,242,0.16)',
  color: '#c7cffc',
}

const primaryButtonStyle: CSSProperties = {
  borderRadius: 8,
  border: `1px solid rgba(88,101,242,0.45)`,
  background: 'rgba(88,101,242,0.2)',
  color: '#c7cffc',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  fontFamily: 'inherit',
  padding: '8px 12px',
}

const secondaryButtonStyle: CSSProperties = {
  borderRadius: 8,
  border: `1px solid ${S.borderLight}`,
  background: 'transparent',
  color: S.textFaint,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
  padding: '8px 12px',
}

const ghostButtonStyle: CSSProperties = {
  border: 'none',
  background: 'none',
  color: S.textDim,
  cursor: 'pointer',
  fontSize: 11,
  textDecoration: 'underline',
  fontFamily: 'inherit',
}
