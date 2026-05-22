import type { FC } from 'react'

const DIFFICULTY: Record<number, { label: string; color: string; bg: string; border: string }> = {
  5: { label: 'Mythic', color: '#c084fc', bg: 'rgba(192,132,252,0.10)', border: 'rgba(192,132,252,0.20)' },
  4: { label: 'Heroic', color: '#60a5fa', bg: 'rgba(96,165,250,0.10)', border: 'rgba(96,165,250,0.20)' },
  3: { label: 'Normal', color: '#4ade80', bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.20)' },
}

type DiffBadgeProps = { difficulty: number }

export const DiffBadge: FC<DiffBadgeProps> = ({ difficulty }) => {
  const d = DIFFICULTY[difficulty] ?? {
    label: `Diff ${difficulty}`,
    color: '#949ba4',
    bg: 'rgba(148,163,184,0.08)',
    border: 'rgba(148,163,184,0.15)',
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 8px',
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 600,
        color: d.color,
        backgroundColor: d.bg,
        border: `1px solid ${d.border}`,
      }}
    >
      {d.label}
    </span>
  )
}
