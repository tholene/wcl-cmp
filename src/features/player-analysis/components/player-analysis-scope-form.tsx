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
    {recentPlayersError && (
      <p style={{ marginTop: 6, fontSize: 11, color: '#f0b232' }}>
        Could not load player suggestions. Manual entry still works.
      </p>
    )}
  </div>
)
