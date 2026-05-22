import { useState, type FC } from 'react'
import { getWowClassColor, getWowClassIconUrl, getWowSpecIconUrl } from '@/lib/wow-class'

type Props = {
  className?: string | null
  specName?: string | null
  size?: number
}

export const SpecIcon: FC<Props> = ({ className, specName, size = 28 }) => {
  // Track which prop combination triggered each failure so failures auto-clear on prop change.
  const [specFailedKey, setSpecFailedKey] = useState<string | null>(null)
  const [classFailedKey, setClassFailedKey] = useState<string | null>(null)

  const color = getWowClassColor(className)
  const specIconUrl = getWowSpecIconUrl(className, specName)
  const classIconUrl = getWowClassIconUrl(className)
  const letter = (specName ?? className ?? '?')[0]
  const radius = Math.round(size * 0.25)

  const currentSpecKey = `${className ?? ''}:${specName ?? ''}`
  const currentClassKey = className ?? ''
  const specFailed = specFailedKey === currentSpecKey
  const classFailed = classFailedKey === currentClassKey

  const showSpec = !!specIconUrl && !specFailed
  const showClass = !showSpec && !!classIconUrl && !classFailed

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
      {showSpec && (
        <img
          src={specIconUrl}
          alt={`${specName ?? ''} ${className ?? ''} icon`}
          width={size}
          height={size}
          style={{ display: 'block', objectFit: 'cover' }}
          onError={() => setSpecFailedKey(currentSpecKey)}
        />
      )}
      {showClass && (
        <img
          src={classIconUrl}
          alt={`${className ?? 'Unknown'} class icon`}
          width={size}
          height={size}
          style={{ display: 'block', objectFit: 'cover' }}
          onError={() => setClassFailedKey(currentClassKey)}
        />
      )}
      {!showSpec && !showClass && letter}
    </div>
  )
}
