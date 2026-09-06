import type {
  RosterAvailabilityEntry,
  RosterDecision,
  RosterDecisionEntry,
  RosterRaidRole,
  RosterRoleTargets,
} from '../types/roster-review.types'

export type RosterRoleCount = {
  role: RosterRaidRole
  start: number
  flex: number
  notSelected: number
  unset: number
}

export type RosterCountSummary = {
  byRole: RosterRoleCount[]
  startTotal: number
  flexTotal: number
  tanksStarting: number
  healersStarting: number
  dpsStarting: number
  unknownRoleStarting: number
  targets: RosterRoleTargets
  /** Human-readable comparisons against targets. Informational, never blocking. */
  notes: string[]
}

export const getDecision = (decisions: Record<string, RosterDecisionEntry>, playerName: string): RosterDecision | null =>
  decisions[playerName]?.decision ?? null

export const summarizeRosterCounts = (
  availability: RosterAvailabilityEntry[],
  decisions: Record<string, RosterDecisionEntry>,
  targets: RosterRoleTargets
): RosterCountSummary => {
  const roles: RosterRaidRole[] = ['tank', 'healer', 'melee', 'ranged', 'unknown']
  const byRole: RosterRoleCount[] = roles.map((role) => ({ role, start: 0, flex: 0, notSelected: 0, unset: 0 }))

  for (const entry of availability) {
    const bucket = byRole.find((row) => row.role === entry.role) as RosterRoleCount
    const decision = getDecision(decisions, entry.playerName)
    if (decision === 'start') bucket.start += 1
    else if (decision === 'flex') bucket.flex += 1
    else if (decision === 'notSelected') bucket.notSelected += 1
    else bucket.unset += 1
  }

  const count = (role: RosterRaidRole): RosterRoleCount => byRole.find((row) => row.role === role) as RosterRoleCount
  const tanksStarting = count('tank').start
  const healersStarting = count('healer').start
  const dpsStarting = count('melee').start + count('ranged').start
  const unknownRoleStarting = count('unknown').start
  const startTotal = byRole.reduce((sum, row) => sum + row.start, 0)
  const flexTotal = byRole.reduce((sum, row) => sum + row.flex, 0)

  const notes: string[] = []
  if (startTotal !== targets.total) {
    notes.push(`${startTotal} starting vs target ${targets.total} (${startTotal > targets.total ? 'over' : 'under'} by ${Math.abs(startTotal - targets.total)}).`)
  }
  if (tanksStarting !== targets.tanks) notes.push(`${tanksStarting} tank(s) starting vs target ${targets.tanks}.`)
  if (healersStarting !== targets.healers) notes.push(`${healersStarting} healer(s) starting vs target ${targets.healers}.`)
  if (dpsStarting !== targets.dps) notes.push(`${dpsStarting} DPS starting vs target ${targets.dps}.`)
  if (unknownRoleStarting > 0) notes.push(`${unknownRoleStarting} starting player(s) have no raid role set.`)

  return { byRole, startTotal, flexTotal, tanksStarting, healersStarting, dpsStarting, unknownRoleStarting, targets, notes }
}
