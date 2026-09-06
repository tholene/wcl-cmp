import type { RosterAvailabilityEntry, RosterRaidReport } from '../types/roster-review.types'

/**
 * Availability entries from participants of the selected logs.
 * Defaults to "available" so officers only need to mark exceptions; role stays
 * unknown until set manually or suggested from WCL evidence.
 */
export const buildEntriesFromReportParticipants = (
  reports: RosterRaidReport[],
  selectedCodes: string[]
): Array<Omit<RosterAvailabilityEntry, 'id'>> => {
  const byName = new Map<string, Omit<RosterAvailabilityEntry, 'id'>>()
  for (const report of reports) {
    if (!selectedCodes.includes(report.code)) continue
    for (const participant of report.participants) {
      const key = participant.name.toLowerCase()
      if (byName.has(key)) continue
      byName.set(key, {
        playerName: participant.name,
        className: participant.className,
        role: 'unknown',
        availability: 'available',
        note: '',
        source: 'logParticipants',
      })
    }
  }
  return [...byName.values()].sort((a, b) => a.playerName.localeCompare(b.playerName))
}
