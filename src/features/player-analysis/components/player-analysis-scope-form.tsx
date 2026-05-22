import type { FC } from 'react'
import { PlayerAutocomplete } from './player-autocomplete'

type RecentPlayer = {
  name: string
  className?: string | null
  lastSeenAt?: number | null
  seenInRaidKillReports?: number
  seenInRaidKillFights?: number
}

type PlayerAnalysisScopeFormProps = {
  players: RecentPlayer[]
  recentPlayersLoading: boolean
  recentPlayersError: string | null
  playerName: string
  onPlayerNameChange: (value: string) => void
  onSelect: (player: RecentPlayer) => void
  onCommit: () => void
  isPreviewing: boolean
}

export const PlayerAnalysisScopeForm: FC<PlayerAnalysisScopeFormProps> = ({
  players,
  recentPlayersLoading,
  recentPlayersError,
  playerName,
  onPlayerNameChange,
  onSelect,
  onCommit,
  isPreviewing,
}) => (
  <div>
    <PlayerAutocomplete
      players={players}
      value={playerName}
      onChange={onPlayerNameChange}
      onSelect={onSelect}
      onCommit={onCommit}
      isPreviewing={isPreviewing}
      isLoading={recentPlayersLoading}
    />
    {playerName.trim() && (
      <button
        type="button"
        onClick={onCommit}
        disabled={isPreviewing}
        style={{
          marginTop: 8,
          width: '100%',
          padding: '8px 14px',
          borderRadius: 8,
          background: isPreviewing ? 'rgba(88,101,242,0.35)' : 'rgba(88,101,242,0.20)',
          border: '1px solid rgba(88,101,242,0.40)',
          color: isPreviewing ? '#949ba4' : '#8a9cf8',
          fontSize: 13,
          fontWeight: 600,
          cursor: isPreviewing ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.15s',
        }}
      >
        {isPreviewing ? 'Loading…' : 'Load boss kills'}
      </button>
    )}
    {recentPlayersError && (
      <p style={{ marginTop: 6, fontSize: 11, color: '#f0b232' }}>
        Could not load player suggestions. Manual entry still works.
      </p>
    )}
  </div>
)
