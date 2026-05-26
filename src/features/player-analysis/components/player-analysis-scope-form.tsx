import type { CSSProperties, FC } from 'react'
import { PlayerAutocomplete } from './player-autocomplete'
import type { GlobalCharacterLookupInput, PlayerLookupMode } from '../types/player-analysis.types'

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
  lookupMode: PlayerLookupMode
  onLookupModeChange: (mode: PlayerLookupMode) => void
  hasGuildId: boolean
  globalLookupInput: GlobalCharacterLookupInput
  onGlobalLookupInputChange: (value: GlobalCharacterLookupInput) => void
  onLoadGlobalBossKills: () => void
  isLoadingGlobalBossKills: boolean
  globalLookupValidationError: string | null
}

const modeButtonStyle = (active: boolean) => ({
  flex: 1,
  borderRadius: 8,
  border: active ? '1px solid rgba(88,101,242,0.45)' : '1px solid transparent',
  background: active ? 'rgba(88,101,242,0.14)' : 'transparent',
  color: active ? '#c9cdfb' : '#949ba4',
  padding: '6px 10px',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
})

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(26,27,30,0.8)',
  color: '#f2f3f5',
  fontSize: 12,
  fontFamily: 'inherit',
  outline: 'none',
} satisfies CSSProperties

export const PlayerAnalysisScopeForm: FC<PlayerAnalysisScopeFormProps> = ({
  players,
  recentPlayersLoading,
  recentPlayersError,
  playerName,
  onPlayerNameChange,
  onSelect,
  onCommit,
  isPreviewing,
  lookupMode,
  onLookupModeChange,
  hasGuildId,
  globalLookupInput,
  onGlobalLookupInputChange,
  onLoadGlobalBossKills,
  isLoadingGlobalBossKills,
  globalLookupValidationError,
}) => (
  <div className="flex flex-col gap-3">
    <div
      style={{
        display: 'flex',
        padding: 4,
        borderRadius: 10,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(32,34,37,0.6)',
      }}
    >
      <button type="button" style={modeButtonStyle(lookupMode === 'guild')} onClick={() => onLookupModeChange('guild')}>
        Guild
      </button>
      <button type="button" style={modeButtonStyle(lookupMode === 'global')} onClick={() => onLookupModeChange('global')}>
        Global
      </button>
    </div>

    {lookupMode === 'guild' ? (
      <>
        <p className="text-xs text-hint">Search players from your configured guild logs.</p>
        {!hasGuildId && (
          <div className="alert-warning">
            Guild mode needs a Guild ID. Add one in Settings or switch to Global.
          </div>
        )}
        <PlayerAutocomplete
          players={players}
          value={playerName}
          onChange={onPlayerNameChange}
          onSelect={onSelect}
          onCommit={onCommit}
          isPreviewing={isPreviewing}
          isLoading={recentPlayersLoading}
          disabled={!hasGuildId}
        />
        {playerName.trim() && (
          <button
            type="button"
            onClick={onCommit}
            disabled={isPreviewing || !hasGuildId}
            style={{
              width: '100%',
              padding: '8px 14px',
              borderRadius: 8,
              background: isPreviewing || !hasGuildId ? 'rgba(88,101,242,0.35)' : 'rgba(88,101,242,0.20)',
              border: '1px solid rgba(88,101,242,0.40)',
              color: isPreviewing || !hasGuildId ? '#949ba4' : '#8a9cf8',
              fontSize: 13,
              fontWeight: 600,
              cursor: isPreviewing || !hasGuildId ? 'not-allowed' : 'pointer',
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
      </>
    ) : (
      <>
        <p className="text-xs text-hint">Paste a Warcraft Logs character URL or enter character details.</p>
        <div className="flex flex-col gap-2">
          <input
            style={inputStyle}
            value={globalLookupInput.characterUrl}
            onChange={(e) => onGlobalLookupInputChange({ ...globalLookupInput, characterUrl: e.target.value })}
            placeholder="https://www.warcraftlogs.com/character/eu/the-maelstrom/bagge"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              style={inputStyle}
              value={globalLookupInput.characterName}
              onChange={(e) => onGlobalLookupInputChange({ ...globalLookupInput, characterName: e.target.value })}
              placeholder="character name"
            />
            <input
              style={inputStyle}
              value={globalLookupInput.region}
              onChange={(e) => onGlobalLookupInputChange({ ...globalLookupInput, region: e.target.value })}
              placeholder="region (e.g. eu)"
            />
            <input
              style={inputStyle}
              value={globalLookupInput.realmSlug}
              onChange={(e) => onGlobalLookupInputChange({ ...globalLookupInput, realmSlug: e.target.value })}
              placeholder="realm slug"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={globalLookupInput.includeWipes}
              onChange={(e) => onGlobalLookupInputChange({ ...globalLookupInput, includeWipes: e.target.checked })}
              style={{ accentColor: '#5865f2' }}
            />
            Include wipes in discovered fights
          </label>
        </div>
        <button
          type="button"
          onClick={onLoadGlobalBossKills}
          disabled={isLoadingGlobalBossKills}
          style={{
            width: '100%',
            padding: '8px 14px',
            borderRadius: 8,
            background: isLoadingGlobalBossKills ? 'rgba(88,101,242,0.35)' : 'rgba(88,101,242,0.20)',
            border: '1px solid rgba(88,101,242,0.40)',
            color: isLoadingGlobalBossKills ? '#949ba4' : '#8a9cf8',
            fontSize: 13,
            fontWeight: 600,
            cursor: isLoadingGlobalBossKills ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {isLoadingGlobalBossKills ? 'Loading…' : 'Load global boss kills'}
        </button>
        {globalLookupValidationError && (
          <div className="alert-error">{globalLookupValidationError}</div>
        )}
      </>
    )}
  </div>
)
