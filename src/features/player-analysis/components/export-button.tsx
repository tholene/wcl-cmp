import { useState, type FC } from 'react'

type ExportButtonProps = { onClick: () => void; disabled: boolean; isStarting: boolean }

export const ExportButton: FC<ExportButtonProps> = ({ onClick, disabled, isStarting }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        padding: '13px 20px',
        borderRadius: 10,
        background: disabled
          ? 'rgba(88,101,242,0.3)'
          : hovered
            ? 'linear-gradient(135deg, #4752c4, #3d47b0)'
            : 'linear-gradient(135deg, #5865f2, #4752c4)',
        border: 'none',
        color: '#fff',
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.6 : 1,
        boxShadow: disabled
          ? 'none'
          : hovered
            ? '0 6px 24px rgba(88,101,242,0.50)'
            : '0 4px 16px rgba(88,101,242,0.30)',
        transition: 'all 0.2s',
      }}
    >
      {isStarting ? 'Starting export…' : 'Export analysis bundle'}
    </button>
  )
}
