import type { FC } from 'react'

type StepDotProps = { number: number; completed: boolean; active: boolean }

export const StepDot: FC<StepDotProps> = ({ number, completed, active }) => {
  if (completed) {
    return (
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          flexShrink: 0,
          background: 'linear-gradient(135deg, #5865f2 0%, #4752c4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 12px rgba(88,101,242,0.20)',
        }}
      >
        <svg
          width={14}
          height={14}
          viewBox="0 0 16 16"
          fill="none"
          stroke="#fff"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
        </svg>
      </div>
    )
  }
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        flexShrink: 0,
        backgroundColor: active ? 'rgba(88,101,242,0.15)' : 'transparent',
        border: `2px solid ${active ? '#5865f2' : '#3f4147'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        fontWeight: 700,
        color: active ? '#c9cdfb' : '#6d6f78',
      }}
    >
      {number}
    </div>
  )
}
