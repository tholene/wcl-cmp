import { createEmptyRosterSession } from '../lib/roster-session-storage'
import type {
  RosterAvailabilityEntry,
  RosterComparisonNote,
  RosterDecisionEntry,
  RosterEvidenceResult,
  RosterRaidRole,
  RosterRaidWindow,
  RosterReviewSession,
  RosterReviewStep,
  RosterRoleTargets,
} from '../types/roster-review.types'

export type RosterReviewAction =
  | { type: 'setStep'; step: RosterReviewStep }
  | { type: 'setRaid'; raid: Partial<RosterRaidWindow> }
  | { type: 'toggleReport'; code: string }
  | { type: 'toggleEncounter'; encounterId: number }
  | { type: 'setRoleTargets'; targets: Partial<Pick<RosterRoleTargets, 'total' | 'tanks' | 'healers'>> }
  | { type: 'addAvailability'; entries: Array<Omit<RosterAvailabilityEntry, 'id'>> }
  | { type: 'updateAvailability'; id: string; patch: Partial<Omit<RosterAvailabilityEntry, 'id'>> }
  | { type: 'removeAvailability'; id: string }
  | { type: 'applySuggestedRoles'; roles: Record<string, RosterRaidRole> }
  | { type: 'setEvidence'; evidence: RosterEvidenceResult | null }
  | { type: 'setDecision'; playerName: string; patch: Partial<RosterDecisionEntry> }
  | { type: 'clearDecision'; playerName: string }
  | { type: 'addComparisonNote'; note: Omit<RosterComparisonNote, 'id' | 'createdAt'> }
  | { type: 'removeComparisonNote'; id: string }
  | { type: 'reset' }

const nextId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 8)}`

const normalizeKey = (name: string): string => name.trim().toLowerCase()

const withTargets = (targets: RosterRoleTargets, patch: Partial<RosterRoleTargets>): RosterRoleTargets => {
  const total = Math.max(0, patch.total ?? targets.total)
  const tanks = Math.max(0, patch.tanks ?? targets.tanks)
  const healers = Math.max(0, patch.healers ?? targets.healers)
  return { total, tanks, healers, dps: Math.max(0, total - tanks - healers) }
}

const touch = (session: RosterReviewSession): RosterReviewSession => ({ ...session, updatedAt: Date.now() })

export const rosterReviewReducer = (session: RosterReviewSession, action: RosterReviewAction): RosterReviewSession => {
  switch (action.type) {
    case 'setStep':
      return touch({ ...session, step: action.step })

    case 'setRaid':
      return touch({ ...session, raid: { ...session.raid, ...action.raid } })

    case 'toggleReport': {
      const has = session.raid.reportCodes.includes(action.code)
      const reportCodes = has
        ? session.raid.reportCodes.filter((code) => code !== action.code)
        : [...session.raid.reportCodes, action.code]
      return touch({ ...session, raid: { ...session.raid, reportCodes } })
    }

    case 'toggleEncounter': {
      const has = session.raid.encounterIds.includes(action.encounterId)
      const encounterIds = has
        ? session.raid.encounterIds.filter((id) => id !== action.encounterId)
        : [...session.raid.encounterIds, action.encounterId]
      return touch({ ...session, raid: { ...session.raid, encounterIds } })
    }

    case 'setRoleTargets':
      return touch({ ...session, roleTargets: withTargets(session.roleTargets, action.targets) })

    case 'addAvailability': {
      const existing = new Set(session.availability.map((entry) => normalizeKey(entry.playerName)))
      const added: RosterAvailabilityEntry[] = []
      for (const entry of action.entries) {
        const key = normalizeKey(entry.playerName)
        if (!key || existing.has(key)) continue
        existing.add(key)
        added.push({ ...entry, playerName: entry.playerName.trim(), id: nextId('avail') })
      }
      if (added.length === 0) return session
      return touch({ ...session, availability: [...session.availability, ...added] })
    }

    case 'updateAvailability':
      return touch({
        ...session,
        availability: session.availability.map((entry) => (entry.id === action.id ? { ...entry, ...action.patch } : entry)),
      })

    case 'removeAvailability': {
      const removed = session.availability.find((entry) => entry.id === action.id)
      const decisions = { ...session.decisions }
      if (removed) delete decisions[removed.playerName]
      return touch({ ...session, availability: session.availability.filter((entry) => entry.id !== action.id), decisions })
    }

    case 'applySuggestedRoles': {
      const lookup = new Map(Object.entries(action.roles).map(([name, role]) => [normalizeKey(name), role]))
      return touch({
        ...session,
        availability: session.availability.map((entry) => {
          if (entry.role !== 'unknown') return entry
          const suggested = lookup.get(normalizeKey(entry.playerName))
          return suggested && suggested !== 'unknown' ? { ...entry, role: suggested } : entry
        }),
      })
    }

    case 'setEvidence':
      return touch({ ...session, evidence: action.evidence })

    case 'setDecision': {
      const current = session.decisions[action.playerName] ?? { decision: 'notSelected', reasonCategory: null, reasonText: '' }
      return touch({ ...session, decisions: { ...session.decisions, [action.playerName]: { ...current, ...action.patch } } })
    }

    case 'clearDecision': {
      const decisions = { ...session.decisions }
      delete decisions[action.playerName]
      return touch({ ...session, decisions })
    }

    case 'addComparisonNote':
      return touch({
        ...session,
        comparisonNotes: [...session.comparisonNotes, { ...action.note, id: nextId('cmp'), createdAt: Date.now() }],
      })

    case 'removeComparisonNote':
      return touch({ ...session, comparisonNotes: session.comparisonNotes.filter((note) => note.id !== action.id) })

    case 'reset':
      return createEmptyRosterSession()

    default:
      return session
  }
}
