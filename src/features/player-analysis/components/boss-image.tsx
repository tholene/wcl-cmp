import { useState, type FC } from 'react'

type Props = {
  encounterId?: number | null
  encounterName: string
  size?: number
}

function BossImagePlaceholder({ encounterName, size }: { encounterName: string; size: number }) {
  const hue = encounterName.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360
  const initials = encounterName
    .split(/[\s&']+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${hue},30%,20%) 0%, hsl(${hue},20%,14%) 100%)`,
        border: `1px solid hsl(${hue},20%,25%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.32,
        fontWeight: 700,
        color: `hsl(${hue},30%,55%)`,
      }}
    >
      {initials}
    </div>
  )
}

export const BossImage: FC<Props> = ({ encounterId, encounterName, size = 44 }) => {
  const [error, setError] = useState(false)

  if (!encounterId || error) {
    return <BossImagePlaceholder encounterName={encounterName} size={size} />
  }

  return (
    <img
      src={`https://assets.rpglogs.com/img/warcraft/bosses/${encounterId}-icon.jpg`}
      alt={encounterName}
      width={size}
      height={size}
      onError={() => setError(true)}
      style={{ borderRadius: 10, flexShrink: 0, objectFit: 'cover' }}
    />
  )
}
