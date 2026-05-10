import type { PlayerFightDeathSummary, PlayerFightReview, PlayerReviewEvent, PlayerReviewFinding } from '../types/player-fight-review'
import { PlayersMapper } from '../mappers/players.mapper'

const OPENER_CAP = 10

function formatDeath(death: PlayerFightDeathSummary): string {
  const time = PlayersMapper.formatRelativeTimestamp(death.deathTimestampRelativeMs)
  const lethal = death.finalDamageEvent
    ? `${death.finalDamageEvent.abilityName} from ${death.finalDamageEvent.sourceName ?? 'unknown source'}`
    : 'unknown from available data'
  return `  - ${time} — lethal: ${lethal}`
}

function formatOpenerEvent(event: PlayerReviewEvent): string {
  const time = PlayersMapper.formatRelativeTimestamp(event.timestampRelativeMs)
  return `  - ${time} ${PlayersMapper.formatEventLine(event)}`
}

function formatFinding(finding: PlayerReviewFinding): string {
  const limitation = finding.limitation ? `\n  Limitation: ${finding.limitation}` : ''
  return `  [${finding.severity.toUpperCase()}] ${finding.title} (${finding.category}, confidence: ${finding.confidence})\n  ${finding.summary}${limitation}`
}

const OFFICER_GUARDRAILS = `RESPONSE FORMAT — use exactly these five sections in order:
1. Visible signals — what this data clearly shows (be specific, cite timestamps and values)
2. Potential concerns — what warrants officer follow-up (distinguish evidence from inference)
3. Analyzer limitations — what the system could not detect (2–3 bullets maximum; do not open the response with this section)
4. Manual checks in WCL — specific log views the officer should pull up
5. Suggested player-facing feedback — include ONLY if sections 1 or 2 contain sufficient evidence; otherwise omit this section

GROUND RULES:
- Do not open with caveats or apologies. Lead with what you can see.
- Distinguish "the analyzer could not detect X" from "the player failed at X." Never conflate them.
- Do not judge performance as good or bad unless the evidence above is strong and unambiguous.
- Do not invent boss mechanics, spec rotations, or assignment context that are not in the data.
- If assignment context is Unknown, do not infer what the player should have been doing.`

const PLAYER_GUARDRAILS = `RESPONSE FORMAT — use exactly these five sections in order:
1. What went well — observable positives from this data
2. Areas to look at — things worth the player reviewing (distinguish evidence from inference)
3. Data gaps — what the analyzer could not see (2–3 bullets maximum)
4. Suggested checks — specific things to review in the WCL log
5. One or two actionable suggestions — only if sections 1 or 2 support them

GROUND RULES:
- Do not open with caveats or disclaimers. Lead with something concrete.
- Write in a supportive, non-shaming tone. Avoid blame language.
- Distinguish "the analyzer could not detect X" from "you made a mistake." Never conflate them.
- Do not judge overall performance as good or bad unless the evidence is unambiguous.
- Do not invent boss mechanics, spec rotations, or assignment context that are not in the data.
- If assignment context is Unknown, do not infer what the player should have been doing.`

function buildEvidenceBlock(review: PlayerFightReview, noDeathsLabel: string): string[] {
  const { fight, player, assignmentContext, evidence, topFindings, source } = review
  const duration = PlayersMapper.formatDurationFromMilliseconds(fight.durationMs)
  const opener = evidence.execution.openerEvents.slice(0, OPENER_CAP)
  const gaps = evidence.execution.longNoCastGapsMs.map((g) => `${Math.round(g / 1000)}s`).join(', ') || 'None detected'
  const deaths = evidence.survivability.deaths

  return [
    `== FIGHT CONTEXT ==`,
    `Encounter: ${fight.encounterName}`,
    `Difficulty ID: ${fight.difficulty}`,
    `Result: ${fight.kill ? 'Kill' : 'Wipe'}`,
    `Duration: ${duration}`,
    ``,
    `== PLAYER IDENTITY ==`,
    `Name: ${player.name}`,
    `Class: ${player.className ?? 'Unknown'}`,
    `Spec: Unknown (not available in this data set)`,
    ``,
    `== ASSIGNMENT CONTEXT ==`,
    `Status: ${assignmentContext.status}`,
    `Note: ${assignmentContext.note}`,
    `Caveat: Assignment data is not available; do not infer expected role or cooldown usage from boss mechanics.`,
    ``,
    `== DEATHS ==`,
    deaths.length ? deaths.map(formatDeath).join('\n') : noDeathsLabel,
    ``,
    `== OPENER (first 45s, capped at ${OPENER_CAP} events) ==`,
    opener.length ? opener.map(formatOpenerEvent).join('\n') : '  No opener events detected.',
    ``,
    `== CAST ACTIVITY ==`,
    `Cast count: ${evidence.execution.castCount}`,
    `Casts per minute: ${evidence.execution.castsPerMinute}`,
    `Long no-cast gaps (>=10s): ${gaps}`,
    ``,
    `== COOLDOWNS / DEFENSIVES / CONSUMABLES ==`,
    `Recognized defensive events: ${evidence.survivability.defensiveEvents.length}`,
    `Recognized consumable events: ${evidence.survivability.consumableEvents.length}`,
    ``,
    `== UTILITY ==`,
    `Interrupts: ${evidence.utility.interrupts.length}`,
    `Dispels: ${evidence.utility.dispels.length}`,
    ``,
    `== TOP FINDINGS ==`,
    topFindings.length ? topFindings.map(formatFinding).join('\n\n') : '  No deterministic findings generated.',
    ``,
    `== SOURCE / LIMITATIONS ==`,
    source.note,
    source.limitations.length ? source.limitations.map((l) => `  - ${l}`).join('\n') : '  No additional limitations noted.',
  ]
}

export function buildOfficerReviewPrompt(review: PlayerFightReview): string {
  return [
    `You are a World of Warcraft raid performance analyst. Review the following player data for a pull and provide an officer-level performance assessment.`,
    ``,
    ...buildEvidenceBlock(review, '  No deaths recorded.'),
    ``,
    OFFICER_GUARDRAILS,
  ].join('\n')
}

export function buildPlayerFeedbackPrompt(review: PlayerFightReview): string {
  return [
    `You are a World of Warcraft raid coach. Write a supportive, constructive performance note for a player based on the following pull data. The player will read this directly.`,
    ``,
    ...buildEvidenceBlock(review, '  No deaths recorded — well done on staying alive.'),
    ``,
    PLAYER_GUARDRAILS,
  ].join('\n')
}

export function buildStructuredPlayerReviewJson(review: PlayerFightReview): string {
  const { fight, player, assignmentContext, evidence, topFindings, source } = review

  const smallArray = <T>(arr: T[]): T[] | { count: number } => (arr.length <= 5 ? arr : { count: arr.length })

  const payload = {
    fight: {
      encounterName: fight.encounterName,
      difficultyId: fight.difficulty,
      result: fight.kill ? 'Kill' : 'Wipe',
      durationMs: fight.durationMs,
    },
    player: {
      name: player.name,
      className: player.className ?? 'Unknown',
      spec: 'Unknown',
    },
    assignmentContext: {
      status: assignmentContext.status,
      note: assignmentContext.note,
    },
    evidence: {
      context: {
        summary: evidence.context.summary,
        confidence: evidence.context.confidence,
        limitations: evidence.context.limitations,
      },
      output: {
        summary: evidence.output.summary,
        confidence: evidence.output.confidence,
        totalDamageDone: evidence.output.totalDamageDone,
        limitations: evidence.output.limitations,
      },
      execution: {
        summary: evidence.execution.summary,
        confidence: evidence.execution.confidence,
        castCount: evidence.execution.castCount,
        castsPerMinute: evidence.execution.castsPerMinute,
        longNoCastGapsMs: evidence.execution.longNoCastGapsMs,
        openerEvents: evidence.execution.openerEvents.slice(0, OPENER_CAP),
        limitations: evidence.execution.limitations,
      },
      survivability: {
        summary: evidence.survivability.summary,
        confidence: evidence.survivability.confidence,
        deaths: evidence.survivability.deaths,
        defensiveEvents: smallArray(evidence.survivability.defensiveEvents),
        consumableEvents: smallArray(evidence.survivability.consumableEvents),
        limitations: evidence.survivability.limitations,
      },
      utility: {
        summary: evidence.utility.summary,
        confidence: evidence.utility.confidence,
        interrupts: smallArray(evidence.utility.interrupts),
        dispels: smallArray(evidence.utility.dispels),
        limitations: evidence.utility.limitations,
      },
      consistency: {
        summary: evidence.consistency.summary,
        confidence: evidence.consistency.confidence,
        limitations: evidence.consistency.limitations,
      },
      confidence: {
        summary: evidence.confidence.summary,
        confidence: evidence.confidence.confidence,
        limitations: evidence.confidence.limitations,
      },
    },
    topFindings: topFindings.map((f) => ({
      category: f.category,
      severity: f.severity,
      confidence: f.confidence,
      title: f.title,
      summary: f.summary,
      limitation: f.limitation,
    })),
    source: {
      note: source.note,
      partial: source.partial,
      limitations: source.limitations,
    },
  }

  return JSON.stringify(payload, null, 2)
}
