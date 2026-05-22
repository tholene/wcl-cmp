const WCL_ICON_BASE = 'https://assets.rpglogs.com/img/warcraft/abilities'

function toIconUrl(icon: string): string {
  if (icon.startsWith('http')) return icon
  return `${WCL_ICON_BASE}/${icon}`
}

export function WclIcon({ icon, alt, size = 18 }: { icon: string; alt: string; size?: number }) {
  return (
    <img
      src={toIconUrl(icon)}
      alt={alt}
      width={size}
      height={size}
      className="inline-block rounded-sm object-cover"
      onError={(e) => {
        ;(e.currentTarget as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}
