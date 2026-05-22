import { useState, type FC } from 'react'

type AdvancedButtonProps = { onClick: () => void }

export const AdvancedButton: FC<AdvancedButtonProps> = ({ onClick }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '6px 12px',
        borderRadius: 8,
        border: `1px solid ${hovered ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)'}`,
        background: hovered ? '#313338' : 'transparent',
        color: hovered ? '#b5bac1' : '#6d6f78',
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >
      <svg
        width={13}
        height={13}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="2.2" />
        <path d="M8 1.5v1.7M8 12.8v1.7M1.5 8h1.7M12.8 8h1.7M3.4 3.4l1.2 1.2M11.4 11.4l1.2 1.2M3.4 12.6l1.2-1.2M11.4 4.6l1.2-1.2" />
      </svg>
      Advanced
    </button>
  )
}
