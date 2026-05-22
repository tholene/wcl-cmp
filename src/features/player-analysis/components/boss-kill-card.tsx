import { useState, type FC } from 'react'
import { BossImage } from './boss-image'

const DIFFICULTY: Record<number, { label: string; color: string; bg: string; border: string }> = {
  5: { label: 'Mythic',  color: '#c084fc', bg: 'rgba(192,132,252,0.10)', border: 'rgba(192,132,252,0.20)' },
  4: { label: 'Heroic',  color: '#60a5fa', bg: 'rgba(96,165,250,0.10)',  border: 'rgba(96,165,250,0.20)' },
  3: { label: 'Normal',  color: '#4ade80', bg: 'rgba(74,222,128,0.10)',  border: 'rgba(74,222,128,0.20)' },
}

const getDiff = (d: number) =>
  DIFFICULTY[d] ?? { label: `Diff ${d}`, color: '#949ba4', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.15)' }

const formatDuration = (ms: number): string => {
  const s = Math.max(Math.floor(ms / 1000), 0)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

type BossKillCardProps = {
  encounterName: string
  encounterId?: number | null
  difficulty: number
  durationMs: number
  startTime: number
  playerItemLevel?: number | null
  reportCode: string
  fightId: number
  isSelected: boolean
  onClick: () => void
}

export const BossKillCard: FC<BossKillCardProps> = ({
  encounterName,
  encounterId,
  difficulty,
  durationMs,
  startTime,
  playerItemLevel,
  isSelected,
  onClick,
}) => {
  const [hovered, setHovered] = useState(false)
  const diff = getDiff(difficulty)

  const borderColor = isSelected
    ? 'rgba(88,101,242,0.40)'
    : hovered
      ? 'rgba(255,255,255,0.10)'
      : 'rgba(255,255,255,0.06)'

  const bgColor = isSelected
    ? 'rgba(88,101,242,0.063)'
    : hovered
      ? 'rgba(49,51,56,0.85)'
      : 'rgba(43,45,49,0.72)'

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '12px 14px',
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: 'pointer',
        borderRadius: 12,
        border: `1px solid ${borderColor}`,
        backgroundColor: bgColor,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: isSelected
          ? '0 0 20px rgba(88,101,242,0.20), inset 0 0 0 1px rgba(88,101,242,0.09)'
          : 'none',
        transition: 'all 0.15s',
      }}
    >
      <BossImage encounterId={encounterId} encounterName={encounterName} size={44} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5' }}>{encounterName}</span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '2px 8px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
            color: diff.color,
            backgroundColor: diff.bg,
            border: `1px solid ${diff.border}`,
          }}>
            {diff.label}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 12, color: '#949ba4' }}>
          <span>{formatDuration(durationMs)}</span>
          {playerItemLevel != null && <span>{playerItemLevel} ilvl</span>}
          <span>{new Date(startTime).toLocaleDateString()}</span>
        </div>
      </div>

      {isSelected && (
        <div style={{ color: '#5865f2', flexShrink: 0 }}>
          <svg width={18} height={18} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
          </svg>
        </div>
      )}
    </button>
  )
}
