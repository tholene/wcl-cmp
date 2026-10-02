import { useState, type FC } from 'react'

type ChipChangeBtnProps = { onClick: () => void }

export const ChipChangeBtn: FC<ChipChangeBtnProps> = ({ onClick }) => {
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
        gap: 4,
        padding: '4px 10px',
        borderRadius: 6,
        border: `1px solid ${hovered ? '#4f5159' : '#3f4147'}`,
        background: hovered ? '#383a40' : 'transparent',
        color: hovered ? '#f2f3f5' : '#949ba4',
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        flexShrink: 0,
      }}
    >
      <svg
        width={11}
        height={11}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M11.5 2.5l2 2L5 13H3v-2z" />
      </svg>
      Change
    </button>
  )
}
