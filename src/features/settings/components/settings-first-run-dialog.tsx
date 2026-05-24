import type { CSSProperties, FC } from 'react'
import type { WclSite } from '@/features/settings/types/app-settings'

const S = {
  bg: '#2b2d31',
  bgMuted: '#1f2024',
  text: '#f2f3f5',
  textMuted: '#b5bac1',
  border: 'rgba(255,255,255,0.08)',
}

type SettingsFirstRunDialogProps = {
  open: boolean
  onChooseSite: (site: WclSite) => void
}

export const SettingsFirstRunDialog: FC<SettingsFirstRunDialogProps> = ({ open, onChooseSite }) => {
  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        backgroundColor: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={cardStyle}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: S.text }}>
          Choose Warcraft Logs site
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: S.textMuted, lineHeight: 1.45 }}>
          Choose which Warcraft Logs site you want to use. You can change this later in Settings.
        </p>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <SiteButton label="Retail" onClick={() => onChooseSite('retail')} />
          <SiteButton label="Classic" onClick={() => onChooseSite('classic')} />
          <SiteButton label="Fresh" onClick={() => onChooseSite('fresh')} />
        </div>
      </div>
    </div>
  )
}

const cardStyle: CSSProperties = {
  width: 'min(460px, 100%)',
  borderRadius: 12,
  border: `1px solid ${S.border}`,
  background: `linear-gradient(180deg, ${S.bg} 0%, ${S.bgMuted} 100%)`,
  padding: 18,
  boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
}

const SiteButton: FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      flex: 1,
      borderRadius: 9,
      border: `1px solid ${S.border}`,
      background: 'rgba(255,255,255,0.03)',
      color: S.text,
      padding: '10px 12px',
      fontFamily: 'inherit',
      fontSize: 12,
      fontWeight: 700,
      cursor: 'pointer',
    }}
  >
    {label}
  </button>
)

