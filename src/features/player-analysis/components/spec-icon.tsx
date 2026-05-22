import type { FC } from 'react'
import { classColor } from '../lib/class-colors'

type Props = {
  className?: string | null
  specName?: string | null
  size?: number
}

export const SpecIcon: FC<Props> = ({ className, specName, size = 28 }) => {
  const color = classColor(className)
  const letter = (specName ?? className ?? '?')[0]
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.25),
        flexShrink: 0,
        background: `linear-gradient(135deg, ${color}28 0%, ${color}10 100%)`,
        border: `1px solid ${color}40`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        color,
      }}
    >
      {letter}
    </div>
  )
}
