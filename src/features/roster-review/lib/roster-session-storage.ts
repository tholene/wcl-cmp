import type {
  RosterAvailability,
  RosterAvailabilityEntry,
  RosterDecision,
  RosterDecisionEntry,
  RosterRaidRole,
  RosterReasonCategory,
  RosterReviewSession,
  RosterReviewStep,
} from '../types/roster-review.types'

export const ROSTER_SESSION_STORAGE_KEY = 'wcl-cmp.roster-review.v1'

export const DEFAULT_ROLE_TARGETS = { total: 20, tanks: 2, healers: 4, dps: 14 } as const

const ROLES: RosterRaidRole[] = ['tank', 'healer', 'melee', 'ranged', 'unknown']
const AVAILABILITY: RosterAvailability[] = ['available', 'late', 'absent']
const DECISIONS: RosterDecision[] = ['start', 'flex', 'notSelected']
const REASONS: RosterReasonCategory[] = ['performance', 'consistency', 'attendance', 'availability', 'composition', 'evidence', 'other']

export const createEmptyRosterSession = (): RosterReviewSession => ({
  version: 1,
  step: 0,
  raid: { targetRaidLabel: '', reportCodes: [], difficulty: null, encounterIds: [] },
  roleTargets: { ...DEFAULT_ROLE_TARGETS },
  availability: [],
  evidence: null,
  decisions: {},
  comparisonNotes: [],
  updatedAt: 0,
})

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback
const intOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback

const normalizeEntry = (raw: unknown): RosterAvailabilityEntry | null => {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  const playerName = text(obj['playerName']).trim()
  if (!playerName) return null
  return {
    id: text(obj['id']) || `${playerName.toLowerCase()}-${Math.random().toString(16).slice(2)}`,
    playerName,
    className: typeof obj['className'] === 'string' ? obj['className'] : null,
    role: oneOf(obj['role'], ROLES, 'unknown'),
    availability: oneOf(obj['availability'], AVAILABILITY, 'available'),
    note: text(obj['note']),
    source: obj['source'] === 'logParticipants' ? 'logParticipants' : 'manual',
  }
}

const normalizeDecision = (raw: unknown): RosterDecisionEntry | null => {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  return {
    decision: oneOf(obj['decision'], DECISIONS, 'notSelected'),
    reasonCategory: typeof obj['reasonCategory'] === 'string' ? oneOf(obj['reasonCategory'], REASONS, 'other') : null,
    reasonText: text(obj['reasonText']),
  }
}

export const normalizeRosterSession = (input: unknown): RosterReviewSession => {
  const empty = createEmptyRosterSession()
  if (!input || typeof input !== 'object') return empty
  const obj = input as Record<string, unknown>
  if (obj['version'] !== 1) return empty

  const raid = (obj['raid'] ?? {}) as Record<string, unknown>
  const targets = (obj['roleTargets'] ?? {}) as Record<string, unknown>
  const total = intOr(targets['total'], DEFAULT_ROLE_TARGETS.total)
  const tanks = intOr(targets['tanks'], DEFAULT_ROLE_TARGETS.tanks)
  const healers = intOr(targets['healers'], DEFAULT_ROLE_TARGETS.healers)

  const decisions: Record<string, RosterDecisionEntry> = {}
  const rawDecisions = obj['decisions']
  if (rawDecisions && typeof rawDecisions === 'object') {
    for (const [name, value] of Object.entries(rawDecisions as Record<string, unknown>)) {
      const normalized = normalizeDecision(value)
      if (normalized) decisions[name] = normalized
    }
  }

  const step = intOr(obj['step'], 0)

  return {
    version: 1,
    step: (step >= 0 && step <= 5 ? step : 0) as RosterReviewStep,
    raid: {
      targetRaidLabel: text(raid['targetRaidLabel']),
      reportCodes: Array.isArray(raid['reportCodes']) ? raid['reportCodes'].filter((c): c is string => typeof c === 'string') : [],
      difficulty: typeof raid['difficulty'] === 'number' ? raid['difficulty'] : null,
      encounterIds: Array.isArray(raid['encounterIds']) ? raid['encounterIds'].filter((c): c is number => typeof c === 'number') : [],
    },
    roleTargets: { total, tanks, healers, dps: Math.max(0, total - tanks - healers) },
    availability: Array.isArray(obj['availability'])
      ? obj['availability'].map(normalizeEntry).filter((e): e is RosterAvailabilityEntry => e !== null)
      : [],
    evidence: obj['evidence'] && typeof obj['evidence'] === 'object' ? (obj['evidence'] as RosterReviewSession['evidence']) : null,
    decisions,
    comparisonNotes: Array.isArray(obj['comparisonNotes'])
      ? obj['comparisonNotes']
          .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
          .map((n) => ({
            id: text(n['id']) || Math.random().toString(16).slice(2),
            playerA: text(n['playerA']),
            playerB: text(n['playerB']),
            text: text(n['text']),
            createdAt: typeof n['createdAt'] === 'number' ? n['createdAt'] : 0,
          }))
          .filter((n) => n.playerA && n.playerB)
      : [],
    updatedAt: typeof obj['updatedAt'] === 'number' ? obj['updatedAt'] : 0,
  }
}

export const loadRosterSession = (): RosterReviewSession => {
  if (typeof window === 'undefined') return createEmptyRosterSession()
  try {
    const raw = window.localStorage.getItem(ROSTER_SESSION_STORAGE_KEY)
    if (!raw) return createEmptyRosterSession()
    return normalizeRosterSession(JSON.parse(raw))
  } catch {
    return createEmptyRosterSession()
  }
}

export const saveRosterSession = (session: RosterReviewSession): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ROSTER_SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Storage may be full or blocked; the in-memory session still works.
  }
}

export const clearRosterSession = (): void => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ROSTER_SESSION_STORAGE_KEY)
}
