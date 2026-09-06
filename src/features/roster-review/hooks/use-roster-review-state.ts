import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { useRecentPlayers } from '@/features/player-analysis/hooks/use-recent-players'
import type { AppSettingsRequestContext } from '@/features/settings/types/app-settings-request-context'
import { buildCandidateComparison } from '../lib/candidate-comparison'
import { buildRosterReviewRows } from '../lib/evidence-grouping'
import { buildEntriesFromReportParticipants } from '../lib/roster-availability-import'
import { summarizeRosterCounts } from '../lib/roster-counts'
import { buildRosterExportJson, buildRosterExportMarkdown } from '../lib/roster-export'
import { clearRosterSession, loadRosterSession, saveRosterSession } from '../lib/roster-session-storage'
import { suggestRaidRole } from '../lib/spec-raid-role'
import type { RosterEvidenceResult, RosterPlayerEvidence, RosterRaidRole, RosterReviewStep } from '../types/roster-review.types'
import { rosterReviewReducer } from './roster-review-reducer'
import { useRosterEvidenceJob } from './use-roster-evidence-job'
import { useRosterRaidReports } from './use-roster-raid-reports'

export type RosterReviewState = ReturnType<typeof useRosterReviewState>

const hasGuild = (context: AppSettingsRequestContext): boolean => !!context.guildId && context.guildId.trim().length > 0

export const useRosterReviewState = (context: AppSettingsRequestContext) => {
  const [session, dispatch] = useReducer(rosterReviewReducer, undefined, loadRosterSession)
  const [compareSelection, setCompareSelection] = useState<string[]>([])
  const [detailsPlayer, setDetailsPlayer] = useState<string | null>(null)

  useEffect(() => {
    saveRosterSession(session)
  }, [session])

  const hasGuildId = hasGuild(context)
  const raidReportsQuery = useRosterRaidReports(context, hasGuildId)
  const recentPlayersQuery = useRecentPlayers(context, hasGuildId)

  const onEvidenceResult = useCallback((result: RosterEvidenceResult) => {
    dispatch({ type: 'setEvidence', evidence: result })
  }, [])
  const evidenceJob = useRosterEvidenceJob(context, { onResult: onEvidenceResult })

  const reports = useMemo(() => raidReportsQuery.data?.reports ?? [], [raidReportsQuery.data])
  const evidence = session.evidence

  const evidenceByName = useMemo(() => {
    const map = new Map<string, RosterPlayerEvidence>()
    for (const player of evidence?.players ?? []) map.set(player.playerName.toLowerCase(), player)
    return map
  }, [evidence])

  const rows = useMemo(
    () => buildRosterReviewRows(session.availability, evidenceByName, session.decisions, session.roleTargets),
    [session.availability, evidenceByName, session.decisions, session.roleTargets]
  )

  const countSummary = useMemo(
    () => summarizeRosterCounts(session.availability, session.decisions, session.roleTargets),
    [session.availability, session.decisions, session.roleTargets]
  )

  const comparison = useMemo(() => {
    if (compareSelection.length !== 2) return null
    const side = (name: string) => {
      const row = rows.find((item) => item.entry.playerName === name)
      return { name, entry: row?.entry ?? null, evidence: row?.evidence ?? null }
    }
    return buildCandidateComparison(side(compareSelection[0]), side(compareSelection[1]))
  }, [compareSelection, rows])

  const exportMarkdown = useMemo(() => buildRosterExportMarkdown({ session, rows, reports }), [session, rows, reports])
  const exportJson = useMemo(() => buildRosterExportJson({ session, rows, reports }), [session, rows, reports])

  const logParticipantEntries = useMemo(
    () => buildEntriesFromReportParticipants(reports, session.raid.reportCodes),
    [reports, session.raid.reportCodes]
  )

  const maxReachable: RosterReviewStep =
    session.raid.reportCodes.length === 0 ? 0 : session.availability.length === 0 ? 1 : evidence === null ? 2 : 5

  const setStep = (step: RosterReviewStep) => dispatch({ type: 'setStep', step: Math.min(step, maxReachable) as RosterReviewStep })

  const toggleCompare = (playerName: string) =>
    setCompareSelection((prev) => {
      if (prev.includes(playerName)) return prev.filter((name) => name !== playerName)
      return prev.length >= 2 ? [prev[1], playerName] : [...prev, playerName]
    })

  const buildEvidence = () => {
    evidenceJob.reset()
    evidenceJob.start({
      reportCodes: session.raid.reportCodes,
      difficulty: session.raid.difficulty,
      encounterIds: session.raid.encounterIds,
      playerNames: session.availability.map((entry) => entry.playerName),
    })
  }

  const applySuggestedRoles = () => {
    const roles: Record<string, RosterRaidRole> = {}
    for (const player of evidence?.players ?? []) {
      roles[player.playerName] = suggestRaidRole(player.className, player.primarySpecName)
    }
    dispatch({ type: 'applySuggestedRoles', roles })
  }

  const resetSession = () => {
    clearRosterSession()
    evidenceJob.reset()
    setCompareSelection([])
    setDetailsPlayer(null)
    dispatch({ type: 'reset' })
  }

  return {
    session,
    dispatch,
    setStep,
    maxReachable,
    hasGuildId,
    reports,
    raidReportsQuery,
    recentPlayers: recentPlayersQuery.data?.players ?? [],
    recentPlayersLoading: recentPlayersQuery.isLoading,
    logParticipantEntries,
    evidence,
    evidenceJob,
    rows,
    countSummary,
    compareSelection,
    toggleCompare,
    clearCompare: () => setCompareSelection([]),
    comparison,
    detailsPlayer,
    setDetailsPlayer,
    buildEvidence,
    applySuggestedRoles,
    exportMarkdown,
    exportJson,
    resetSession,
  }
}
