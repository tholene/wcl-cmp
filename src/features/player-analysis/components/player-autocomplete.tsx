import { useEffect, useRef, useState, type FC } from 'react'
import { classColor } from '../lib/class-colors'
import { SpecIcon } from './spec-icon'

type RecentPlayer = {
  name: string
  className?: string | null
  lastSeenAt?: number | null
  seenInRaidKillReports?: number
  seenInRaidKillFights?: number
}

type PlayerAutocompleteProps = {
  players: RecentPlayer[]
  value: string
  onChange: (value: string) => void
  onSelect: (player: RecentPlayer) => void
  onCommit: () => void
  isPreviewing?: boolean
  isLoading?: boolean
}

const formatLastSeen = (ts: number | null | undefined): string => {
  if (!ts) return ''
  const diffMs = Date.now() - ts
  const diffH = Math.floor(diffMs / 3_600_000)
  if (diffH < 1) return 'just now'
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return `${Math.floor(diffD / 7)}w ago`
}

export const PlayerAutocomplete: FC<PlayerAutocompleteProps> = ({
  players,
  value,
  onChange,
  onSelect,
  onCommit,
  isLoading,
}) => {
  const [open, setOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const query = value.trim().toLowerCase()
  const knownClass = (p: RecentPlayer) => !!p.className && p.className.toLowerCase() !== 'unknown'
  const filtered = query
    ? players.filter((p) => knownClass(p) && p.name.toLowerCase().includes(query))
    : players.filter(knownClass)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handlePick = (p: RecentPlayer) => {
    onChange(p.name)
    setOpen(false)
    onSelect(p)
  }

  const borderColor = focused ? 'rgba(88,101,242,0.6)' : 'rgba(255,255,255,0.06)'

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 10,
          backgroundColor: '#1a1b1e',
          border: `1px solid ${borderColor}`,
          transition: 'border-color 0.15s',
        }}
      >
        {/* Search icon */}
        <svg
          width={16}
          height={16}
          viewBox="0 0 16 16"
          fill="none"
          stroke="#6d6f78"
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="7" cy="7" r="4.5" />
          <line x1="10.2" y1="10.2" x2="13.5" y2="13.5" />
        </svg>
        <input
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: '#f2f3f5',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
          placeholder="Search for a player…"
          value={value}
          autoComplete="off"
          aria-label="Character name"
          onChange={(e) => {
            onChange(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setFocused(true)
            setOpen(true)
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered.length > 0 && open) {
                handlePick(filtered[0])
              } else {
                setOpen(false)
                onCommit()
              }
            }
            if (e.key === 'Escape') setOpen(false)
          }}
        />
        {isLoading && (
          <span style={{ fontSize: 11, color: '#6d6f78', flexShrink: 0 }}>Loading…</span>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            marginTop: 4,
            borderRadius: 10,
            overflow: 'hidden',
            background: 'rgba(55,57,63,0.95)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              fontSize: 10,
              fontWeight: 600,
              color: '#6d6f78',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {query ? 'Results' : 'Recent players'}
          </div>
          {filtered.map((p) => (
            <PlayerRow key={p.name} player={p} onPick={handlePick} />
          ))}
        </div>
      )}
    </div>
  )
}

const PlayerRow: FC<{ player: RecentPlayer; onPick: (p: RecentPlayer) => void }> = ({ player: p, onPick }) => {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={(e) => {
        e.preventDefault()
        onPick(p)
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '10px 12px',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        background: hovered ? '#383a40' : 'transparent',
        color: '#f2f3f5',
        fontSize: 13,
        fontFamily: 'inherit',
        transition: 'background 0.1s',
      }}
    >
      <SpecIcon className={p.className} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: classColor(p.className) }}>{p.name}</div>
        {p.className && (
          <div style={{ fontSize: 11, color: '#949ba4' }}>{p.className}</div>
        )}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        {p.lastSeenAt && (
          <div style={{ fontSize: 11, color: '#6d6f78' }}>{formatLastSeen(p.lastSeenAt)}</div>
        )}
        {(p.seenInRaidKillFights ?? 0) > 0 && (
          <div style={{ fontSize: 10, color: '#6d6f78' }}>{p.seenInRaidKillFights} fights</div>
        )}
      </div>
    </button>
  )
}
