import { getDifficultyLabel } from '@/lib/difficulty'
import type { RosterRaidReport, RosterReviewSession } from '../types/roster-review.types'
import type { RosterReviewRow } from './evidence-grouping'
import { EVIDENCE_TAG_LABELS } from './evidence-grouping'
import { summarizeRosterCounts } from './roster-counts'
import { formatAmount, formatDate, formatIlvl, formatPercentile } from './roster-format'
import { RAID_ROLE_LABELS } from './spec-raid-role'

export const ROSTER_REVIEW_LLM_PROMPT = `Review this proposed Mythic progression roster for a World of Warcraft guild.

Evaluate whether the selection criteria have been applied consistently across all players. Identify questionable Start/Flex/Bench decisions, composition problems, and cases where the evidence is insufficient to support the stated reason.

Rules for your review:
- Do not rank players solely by a single percentile.
- Overall parse is the primary performance context; ilvl-bracket parse is secondary diagnostic context (efficiency relative to similar gear).
- Recent and repeatable performance matters more than one historic best.
- "Log presence" means the player appeared in the selected Warcraft Logs reports. It is not proof of an unexcused absence.
- Composition needs can legitimately override a small performance difference; attendance can legitimately break ties between comparable players.
- Where data is marked unknown or the sample is small, say so rather than guessing.
- Be direct and constructive. Do not shame players.

Please produce:
1. Consistency check: are similar cases treated similarly? List any pairs that look inconsistent.
2. Questionable decisions: Start/Flex/Bench choices where the stated reason is weak or contradicted by evidence.
3. Composition review: role counts against targets, obvious class/utility gaps, and any spec concerns.
4. Insufficient evidence: players whose decision rests on too little data, and what would resolve it.
5. Suggested wording: short, fair explanations officers could give to benched or flexed players.`

const DECISION_LABELS = { start: 'Start', flex: 'Flex / Bench', notSelected: 'Not selected' } as const

const escapeCell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ')

const signalSummary = (row: RosterReviewRow): string =>
  row.evidence ? row.evidence.signals.map((signal) => signal.label).join('; ') || '—' : 'no evidence'

export type RosterExportInput = {
  session: RosterReviewSession
  rows: RosterReviewRow[]
  reports: RosterRaidReport[]
}

export const buildRosterExportMarkdown = ({ session, rows, reports }: RosterExportInput): string => {
  const { raid, roleTargets, availability, decisions, comparisonNotes, evidence } = session
  const counts = summarizeRosterCounts(availability, decisions, roleTargets)
  const selectedReports = raid.reportCodes.map((code) => reports.find((report) => report.code === code) ?? evidence?.reports.find((report) => report.code === code) ?? null)
  const lines: string[] = []

  lines.push('# Mythic Roster Review')
  lines.push('')
  lines.push(`- Target raid: ${raid.targetRaidLabel || '(not named)'}`)
  lines.push(`- Difficulty filter for evidence: ${raid.difficulty === null ? 'all' : getDifficultyLabel(raid.difficulty)}`)
  lines.push(`- Boss filter: ${raid.encounterIds.length === 0 ? 'all bosses' : `${raid.encounterIds.length} selected`}`)
  lines.push(`- Role targets: ${roleTargets.total} total, ${roleTargets.tanks} tanks, ${roleTargets.healers} healers, ${roleTargets.dps} DPS`)
  lines.push(`- Evidence generated: ${evidence ? new Date(evidence.generatedAt).toISOString() : 'not built'}`)
  lines.push('')
  lines.push('## Evidence window (Warcraft Logs reports)')
  lines.push('')
  if (selectedReports.length === 0) lines.push('_No reports selected._')
  selectedReports.forEach((report, index) => {
    const code = raid.reportCodes[index]
    if (!report) {
      lines.push(`- ${code} (details unavailable)`)
      return
    }
    lines.push(`- ${report.title} — ${formatDate(report.startTime)} — ${report.url}`)
  })
  lines.push('')

  lines.push('## Roster counts')
  lines.push('')
  lines.push(`- Starting: ${counts.startTotal} (tanks ${counts.tanksStarting}, healers ${counts.healersStarting}, DPS ${counts.dpsStarting}${counts.unknownRoleStarting ? `, unknown role ${counts.unknownRoleStarting}` : ''})`)
  lines.push(`- Flex / bench: ${counts.flexTotal}`)
  counts.notes.forEach((note) => lines.push(`- Note: ${note}`))
  lines.push('')

  lines.push('## Available players and evidence')
  lines.push('')
  lines.push('Columns: Overall = WCL overall parse percentile (primary performance context). Bracket = ilvl-bracket parse (secondary diagnostic). Logs = presence in selected reports (not an attendance verdict). Deaths = deaths on checked kill fights.')
  lines.push('')
  lines.push('| Player | Class / Spec | Role | Availability | Overall median | Overall latest | Overall best | Bracket median | Ilvl | Output (mean) | Logs | Sat out | Deaths | Sample | Signals | Decision | Officer note |')
  lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
  for (const row of rows) {
    const e = row.evidence
    const p = e?.performance
    const decision = row.decision ? DECISION_LABELS[row.decision.decision] : 'undecided'
    lines.push(
      `| ${escapeCell(row.entry.playerName)} | ${escapeCell(`${e?.className ?? row.entry.className ?? '?'} / ${e?.primarySpecName ?? '?'}`)} | ${RAID_ROLE_LABELS[row.entry.role]} | ${row.entry.availability} | ${formatPercentile(p?.overall?.median)} | ${formatPercentile(p?.overall?.latest)} | ${formatPercentile(p?.overall?.best)} | ${formatPercentile(p?.bracket?.median)} | ${formatIlvl(p?.itemLevel?.latest)} | ${p?.output ? `${formatAmount(p.output.meanAmount)} ${p.output.metric}` : '—'} | ${e ? `${e.logPresence.reportsPresent}/${e.logPresence.reportsTotal}` : '—'} | ${e ? e.fightPresence.satOutKillFights : '—'} | ${e ? `${e.execution.deaths} in ${e.execution.fightsWithDeath}/${e.execution.killFightsChecked}` : '—'} | ${p?.sampleSize ?? 0} | ${escapeCell(signalSummary(row))} | ${decision} | ${escapeCell(row.entry.note || '')} |`
    )
  }
  lines.push('')

  lines.push('## Heuristic tags (transparent, non-scoring)')
  lines.push('')
  for (const row of rows) {
    if (row.tags.length === 0) continue
    lines.push(`- ${row.entry.playerName}: ${row.tags.map((tag) => EVIDENCE_TAG_LABELS[tag]).join(', ')}`)
  }
  lines.push('')

  lines.push('## Decisions and reasons')
  lines.push('')
  const byDecision = (key: 'start' | 'flex' | 'notSelected') => rows.filter((row) => row.decision?.decision === key)
  for (const key of ['start', 'flex', 'notSelected'] as const) {
    const group = byDecision(key)
    lines.push(`### ${DECISION_LABELS[key]} (${group.length})`)
    lines.push('')
    if (group.length === 0) lines.push('_none_')
    for (const row of group) {
      const reason = row.decision?.reasonText?.trim()
      const category = row.decision?.reasonCategory ? ` [${row.decision.reasonCategory}]` : ''
      lines.push(`- ${row.entry.playerName} (${RAID_ROLE_LABELS[row.entry.role]})${category}: ${reason || '_no reason recorded_'}`)
    }
    lines.push('')
  }
  const undecided = rows.filter((row) => !row.decision)
  if (undecided.length > 0) {
    lines.push(`### Undecided (${undecided.length})`)
    lines.push('')
    undecided.forEach((row) => lines.push(`- ${row.entry.playerName}`))
    lines.push('')
  }

  lines.push('## Comparison notes')
  lines.push('')
  if (comparisonNotes.length === 0) lines.push('_none_')
  for (const note of comparisonNotes) {
    lines.push(`### ${note.playerA} vs ${note.playerB}`)
    lines.push('')
    lines.push(note.text.trim() || '_empty_')
    lines.push('')
  }

  lines.push('## Data warnings and gaps')
  lines.push('')
  const warnings: string[] = []
  if (!evidence) warnings.push('Evidence has not been built for this session.')
  evidence?.warnings.forEach((warning) => warnings.push(warning))
  for (const row of rows) {
    if (!row.evidence) warnings.push(`${row.entry.playerName}: no evidence row (not part of the evidence run).`)
    row.evidence?.warnings.forEach((warning) => warnings.push(`${row.entry.playerName}: ${warning}`))
  }
  if (warnings.length === 0) lines.push('_none_')
  warnings.forEach((warning) => lines.push(`- ${warning}`))
  lines.push('')

  lines.push('## Review request')
  lines.push('')
  lines.push(ROSTER_REVIEW_LLM_PROMPT)
  lines.push('')

  return lines.join('\n')
}

export const buildRosterExportJson = ({ session, rows, reports }: RosterExportInput): string => {
  const payload = {
    exportedAt: new Date().toISOString(),
    targetRaid: session.raid.targetRaidLabel,
    evidenceWindow: {
      reportCodes: session.raid.reportCodes,
      difficulty: session.raid.difficulty,
      difficultyLabel: session.raid.difficulty === null ? 'all' : getDifficultyLabel(session.raid.difficulty),
      encounterIds: session.raid.encounterIds,
      reports: session.raid.reportCodes.map((code) => {
        const report = reports.find((item) => item.code === code)
        return report ? { code, title: report.title, url: report.url, startTime: report.startTime } : { code }
      }),
    },
    roleTargets: session.roleTargets,
    counts: summarizeRosterCounts(session.availability, session.decisions, session.roleTargets),
    players: rows.map((row) => ({
      playerName: row.entry.playerName,
      availability: { status: row.entry.availability, role: row.entry.role, note: row.entry.note, source: row.entry.source },
      decision: row.decision,
      tags: row.tags,
      evidence: row.evidence,
    })),
    comparisonNotes: session.comparisonNotes,
    warnings: session.evidence?.warnings ?? [],
    reviewPrompt: ROSTER_REVIEW_LLM_PROMPT,
  }
  return JSON.stringify(payload, null, 2)
}
