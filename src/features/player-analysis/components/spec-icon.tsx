import { useState, type FC } from 'react'
import { getWowClassColor, getWowClassIconUrl } from '@/lib/wow-class'

type Props = {
  className?: string | null
  specName?: string | null
  size?: number
}

export const SpecIcon: FC<Props> = ({ className, specName, size = 28 }) => {
  const [iconFailed, setIconFailed] = useState(false)
  const color = getWowClassColor(className)
  const iconUrl = getWowClassIconUrl(className)
  const letter = (specName ?? className ?? '?')[0]
  const radius = Math.round(size * 0.25)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        overflow: 'hidden',
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
      {iconUrl && !iconFailed ? (
        <img
          src={iconUrl}
          alt={`${className ?? 'Unknown'} class icon`}
          width={size}
          height={size}
          style={{ display: 'block', objectFit: 'cover' }}
          onError={() => setIconFailed(true)}
        />
      ) : (
        letter
      )}
    </div>
  )
}
