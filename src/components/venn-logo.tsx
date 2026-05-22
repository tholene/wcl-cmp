import { useEffect, useState } from 'react'

const BLURPLE = '#5865f2'

const CLASS_COLORS_SEQUENCE = [
  '#C41E3A', // Death Knight
  '#A330C9', // Demon Hunter
  '#FF7C0A', // Druid
  '#33937F', // Evoker
  '#AAD372', // Hunter
  '#3FC7EB', // Mage
  '#00FF98', // Monk
  '#F48CBA', // Paladin
  '#FFFFFF', // Priest
  '#FFF468', // Rogue
  '#0070DD', // Shaman
  '#8788EE', // Warlock
  '#C69B6D', // Warrior
]

type VennLogoProps = {
  size?: number
  animate?: boolean
  speed?: 'slow' | 'normal' | 'fast'
  colorMode?: 'blurple' | 'classCycle' | 'custom'
  color?: string
  className?: string
}

export function VennLogo({
  size = 28,
  animate = false,
  speed = 'normal',
  colorMode = 'blurple',
  color,
  className,
}: VennLogoProps) {
  const [cycleIdx, setCycleIdx] = useState(0)

  useEffect(() => {
    if (colorMode !== 'classCycle' || !animate) return
    const t = setInterval(() => setCycleIdx((i) => (i + 1) % CLASS_COLORS_SEQUENCE.length), 800)
    return () => clearInterval(t)
  }, [colorMode, animate])

  const activeColor =
    colorMode === 'custom'
      ? (color ?? BLURPLE)
      : colorMode === 'classCycle'
        ? CLASS_COLORS_SEQUENCE[cycleIdx]
        : BLURPLE

  const dur = speed === 'fast' ? '1.5s' : speed === 'slow' ? '3.5s' : '2.2s'
  const s = size
  const cx = s / 2
  const r = s * 0.24
  const offset = s * 0.13
  const filterId = `venn-glow-${size}`

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className={className}>
      <defs>
        <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={s * 0.03} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${filterId})`}>
        <circle
          cx={cx - offset}
          cy={cx}
          r={r}
          fill="none"
          stroke={activeColor}
          strokeWidth={s * 0.04}
          opacity={0.85}
        >
          {animate && (
            <>
              <animate
                attributeName="cx"
                values={`${cx - offset * 1.5};${cx - offset * 0.6};${cx - offset * 0.6};${cx - offset * 1.5}`}
                dur={dur}
                repeatCount="indefinite"
                keyTimes="0;0.3;0.7;1"
              />
              <animate
                attributeName="opacity"
                values="0.6;0.9;0.9;0.6"
                dur={dur}
                repeatCount="indefinite"
                keyTimes="0;0.3;0.7;1"
              />
            </>
          )}
        </circle>
        <circle
          cx={cx + offset}
          cy={cx}
          r={r}
          fill="none"
          stroke={activeColor}
          strokeWidth={s * 0.04}
          opacity={0.5}
        >
          {animate && (
            <>
              <animate
                attributeName="cx"
                values={`${cx + offset * 1.5};${cx + offset * 0.6};${cx + offset * 0.6};${cx + offset * 1.5}`}
                dur={dur}
                repeatCount="indefinite"
                keyTimes="0;0.3;0.7;1"
              />
              <animate
                attributeName="opacity"
                values="0.3;0.6;0.6;0.3"
                dur={dur}
                repeatCount="indefinite"
                keyTimes="0;0.3;0.7;1"
              />
            </>
          )}
        </circle>
      </g>
    </svg>
  )
}
