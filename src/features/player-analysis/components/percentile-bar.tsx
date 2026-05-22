import type { FC } from 'react'
import { parseColor } from '../lib/class-colors'

type Props = {
  value: number
  compact?: boolean
}

export const PercentileBar: FC<Props> = ({ value, compact }) => {
  const color = parseColor(value)
  const width = compact ? 40 : 56
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width,
          height: 4,
          borderRadius: 2,
          backgroundColor: `${color}20`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${Math.min(value, 100)}%`,
            height: '100%',
            borderRadius: 2,
            backgroundColor: color,
            boxShadow: `0 0 6px ${color}60`,
          }}
        />
      </div>
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 20,
        }}
      >
        {value}
      </span>
    </div>
  )
}
