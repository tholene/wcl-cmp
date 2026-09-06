import { describe, expect, it } from 'vitest'
import { makeAvailabilityEntry, makeEvidenceResult, makePlayerEvidence, makeRaidReport } from '@/test/factories/roster-review.factory'
import { buildRosterReviewRows } from '../evidence-grouping'
import { buildRosterExportJson, buildRosterExportMarkdown, ROSTER_REVIEW_LLM_PROMPT } from '../roster-export'
import { createEmptyRosterSession } from '../roster-session-storage'

const build = () => {
  const bagge = makePlayerEvidence({ playerName: 'Bagge' })
  const ghost = makePlayerEvidence({ playerName: 'Ghost', status: 'notFound', warnings: ['Ghost was not found in any selected report.'], performance: { ...makePlayerEvidence().performance, sampleSize: 0, overall: null } })
  const availability = [
    makeAvailabilityEntry({ playerName: 'Bagge', note: 'can | swap' }),
    makeAvailabilityEntry({ playerName: 'Ghost', role: 'melee', availability: 'absent' }),
  ]
  const session = {
    ...createEmptyRosterSession(),
    raid: { targetRaidLabel: 'Mythic Wed', reportCodes: ['R1'], difficulty: 4, encounterIds: [] },
    availability,
    evidence: makeEvidenceResult([bagge, ghost], { warnings: ['Report R2 could not be loaded.'] }),
    decisions: { Bagge: { decision: 'start' as const, reasonCategory: 'performance' as const, reasonText: 'Strongest ranged median.' } },
    comparisonNotes: [{ id: 'c1', playerA: 'Bagge', playerB: 'Ghost', text: 'Bagge selected: evidence.', createdAt: 1 }],
  }
  const rows = buildRosterReviewRows(availability, new Map([['bagge', bagge], ['ghost', ghost]]), session.decisions, session.roleTargets)
  return { session, rows, reports: [makeRaidReport()] }
}

describe('roster export', () => {
  it('produces markdown with evidence, decisions, warnings and the review prompt', () => {
    const markdown = buildRosterExportMarkdown(build())
    expect(markdown).toContain('# Mythic Roster Review')
    expect(markdown).toContain('Target raid: Mythic Wed')
    expect(markdown).toContain('https://www.warcraftlogs.com/reports/R1')
    expect(markdown).toContain('| Bagge | Mage / Fire | Ranged | available | 78 | 80 | 90 | 72 | 620 | 1.40M dps | 2/2 | 0 | 1 in 1/4 | 4 |')
    expect(markdown).toContain('can \\| swap')
    expect(markdown).toContain('### Start (1)')
    expect(markdown).toContain('- Bagge (Ranged) [performance]: Strongest ranged median.')
    expect(markdown).toContain('### Undecided (1)')
    expect(markdown).toContain('Report R2 could not be loaded.')
    expect(markdown).toContain('Ghost: Ghost was not found in any selected report.')
    expect(markdown).toContain('### Bagge vs Ghost')
    expect(markdown).toContain(ROSTER_REVIEW_LLM_PROMPT)
    expect(markdown).toContain('Do not rank players solely by a single percentile')
  })

  it('produces JSON with players, decisions and the prompt', () => {
    const parsed = JSON.parse(buildRosterExportJson(build()))
    expect(parsed.targetRaid).toBe('Mythic Wed')
    expect(parsed.players).toHaveLength(2)
    expect(parsed.players[0].decision.decision).toBe('start')
    expect(parsed.players[1].evidence.status).toBe('notFound')
    expect(parsed.reviewPrompt).toBe(ROSTER_REVIEW_LLM_PROMPT)
    expect(parsed.counts.startTotal).toBe(1)
  })
})
