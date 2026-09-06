import { useState, type FC } from 'react'
import { PlayerAutocomplete } from '@/features/player-analysis/components/player-autocomplete'
import { SpecIcon } from '@/features/player-analysis/components/spec-icon'
import { getWowClassColor } from '@/lib/wow-class'
import type { RecentPlayer } from '@/features/player-analysis/types/player-analysis.types'
import { RAID_ROLE_LABELS, RAID_ROLE_ORDER } from '../lib/spec-raid-role'
import type { RosterAvailability, RosterAvailabilityEntry, RosterRaidRole } from '../types/roster-review.types'
import { RosterButton, RosterInput, RosterSectionTitle, RosterSelect } from './roster-ui'

const AVAILABILITY_OPTIONS: Array<{ value: RosterAvailability; label: string }> = [
  { value: 'available', label: 'Available' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
]

type AvailabilityStepProps = {
  entries: RosterAvailabilityEntry[]
  recentPlayers: RecentPlayer[]
  recentPlayersLoading: boolean
  logParticipantCount: number
  onAdd: (entries: Array<Omit<RosterAvailabilityEntry, 'id'>>) => void
  onAddFromLogs: () => void
  onUpdate: (id: string, patch: Partial<Omit<RosterAvailabilityEntry, 'id'>>) => void
  onRemove: (id: string) => void
  onBack: () => void
  onContinue: () => void
}

export const AvailabilityStep: FC<AvailabilityStepProps> = ({
  entries, recentPlayers, recentPlayersLoading, logParticipantCount, onAdd, onAddFromLogs, onUpdate, onRemove, onBack, onContinue,
}) => {
  const [query, setQuery] = useState('')

  const addByName = (name: string, className: string | null) => {
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd([{ playerName: trimmed, className, role: 'unknown', availability: 'available', note: '', source: 'manual' }])
    setQuery('')
  }

  const counts = AVAILABILITY_OPTIONS.map((option) => ({ ...option, count: entries.filter((entry) => entry.availability === option.value).length }))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] text-muted">
        Who is actually available for the target raid? Enter signups manually for now (Raid-Helper import can slot in here later).
        Everyone defaults to available; mark late or absent and add a short note where it matters.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <PlayerAutocomplete
          players={recentPlayers}
          value={query}
          onChange={setQuery}
          onSelect={(player) => addByName(player.name, player.className ?? null)}
          onCommit={() => addByName(query, null)}
          isLoading={recentPlayersLoading}
        />
        <RosterButton onClick={onAddFromLogs} disabled={logParticipantCount === 0} title="Adds every player logged in the selected reports as available">
          + Add everyone in selected logs ({logParticipantCount})
        </RosterButton>
      </div>

      <RosterSectionTitle right={<span className="text-[11px] text-hint">{counts.map((c) => `${c.count} ${c.label.toLowerCase()}`).join(' · ')}</span>}>
        Players ({entries.length})
      </RosterSectionTitle>

      {entries.length === 0 ? (
        <p className="text-xs text-hint">No players yet. Search above or add everyone from the selected logs.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-separate border-spacing-y-1 text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-[0.08em] text-hint">
                <th className="px-2 py-1 font-semibold">Player</th>
                <th className="px-2 py-1 font-semibold">Raid role</th>
                <th className="px-2 py-1 font-semibold">Availability</th>
                <th className="px-2 py-1 font-semibold">Officer note</th>
                <th className="px-2 py-1" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="rounded-lg bg-[rgba(26,27,30,0.6)]">
                  <td className="rounded-l-lg px-2 py-1.5">
                    <span className="flex items-center gap-2">
                      <SpecIcon className={entry.className ?? undefined} size={22} />
                      <span className="font-semibold" style={{ color: getWowClassColor(entry.className) }}>{entry.playerName}</span>
                      {entry.source === 'logParticipants' && <span className="text-[10px] text-hint">from logs</span>}
                    </span>
                  </td>
                  <td className="px-2 py-1.5">
                    <RosterSelect value={entry.role} onChange={(event) => onUpdate(entry.id, { role: event.target.value as RosterRaidRole })}>
                      {RAID_ROLE_ORDER.map((role) => <option key={role} value={role}>{RAID_ROLE_LABELS[role]}</option>)}
                    </RosterSelect>
                  </td>
                  <td className="px-2 py-1.5">
                    <RosterSelect value={entry.availability} onChange={(event) => onUpdate(entry.id, { availability: event.target.value as RosterAvailability })}>
                      {AVAILABILITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </RosterSelect>
                  </td>
                  <td className="px-2 py-1.5">
                    <RosterInput value={entry.note} placeholder="e.g. late until 20:30, swapping to Frost" onChange={(event) => onUpdate(entry.id, { note: event.target.value })} />
                  </td>
                  <td className="rounded-r-lg px-2 py-1.5 text-right">
                    <RosterButton tone="danger" onClick={() => onRemove(entry.id)} aria-label={`Remove ${entry.playerName}`}>×</RosterButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between">
        <RosterButton onClick={onBack}>← Raid</RosterButton>
        <RosterButton tone="primary" disabled={entries.length === 0} onClick={onContinue}>Continue to evidence →</RosterButton>
      </div>
    </div>
  )
}
