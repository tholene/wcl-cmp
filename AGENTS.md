# AGENTS.md — Warcraft Logs Guild Analyzer

## Project identity

This repository is a private, local-first Warcraft Logs Guild Analyzer for a World of Warcraft raid guild. Its purpose is to help guild officers review Warcraft Logs reports efficiently and turn raid evidence into constructive coaching insights.

The app must remain officer-friendly, privacy-conscious, and evidence-led. Avoid features that shame players, overstate conclusions, or present AI-generated judgement as fact.

## Current stack and architecture

Frontend:
- React + TypeScript + Vite
- Tailwind CSS with shadcn-inspired UI primitives
- TanStack Query for data fetching
- React Router for routing

Backend:
- Local Express server
- Warcraft Logs v2 GraphQL API
- OAuth client credentials flow handled server-side
- `.env` config only; never expose or commit secrets

Existing frontend shape:

```txt
src/
├── components/
│   ├── layout/
│   └── ui/
├── features/
│   └── reports/
│       ├── api/
│       ├── components/
│       ├── containers/
│       ├── hooks/
│       ├── mappers/
│       ├── services/
│       └── types/
└── lib/
    ├── query-client.ts
    ├── query-keys.ts
    ├── routes.ts
    └── utils.ts
```

Existing backend shape:

```txt
server/
├── index.ts
└── warcraft-logs/
    ├── wcl-client.ts
    ├── wcl-config.ts
    ├── wcl-service.ts
    └── wcl-types.ts
```

Existing backend endpoints:

```txt
GET /api/health
GET /api/config/status
GET /api/reports/recent
GET /api/reports/:code
GET /auth/callback
```

## Global coding rules

1. Preserve the local-first model.
   - Do not add remote persistence.
   - Do not add OpenAI API integration unless explicitly requested.
   - Do not send Warcraft Logs data to external services from the app.

2. Keep WCL credentials server-side.
   - Browser code must never receive `WCL_CLIENT_ID`, `WCL_CLIENT_SECRET`, OAuth tokens, or any equivalent secret.
   - Do not log secrets.
   - Do not commit `.env` values.

3. Use the official Warcraft Logs v2 GraphQL API.
   - Do not scrape Warcraft Logs web pages.
   - Add GraphQL queries through the existing backend WCL client/service pattern.
   - Handle partial WCL failures gracefully and surface useful error messages.

4. Follow the existing feature architecture.
   - New frontend features should live under `src/features/<feature-name>/`.
   - Prefer this structure:

```txt
api/
components/
containers/
hooks/
mappers/
services/
types/
```

5. Maintain the data-access layering pattern.
   - Frontend feature API code should use:
     - RestService → Service → Hook
   - Keep the Service layer even if it is initially a pass-through.
   - Do not collapse feature API calls directly into components.

6. Reuse existing shared primitives.
   - Prefer existing `components/layout`, `components/ui`, route helpers, query keys, and utility functions.
   - Do not duplicate layout wrappers across pages.
   - Route-level shells should be defined once at the router/layout boundary.
   - If a local component is created instead of reusing an existing shared primitive, make the reason obvious in code structure or comments.

7. Prefer typed, incremental MVPs.
   - Add TypeScript request/response types before wiring UI.
   - Avoid broad speculative analyzers.
   - Build small, testable slices.

8. Keep UI clean and officer-friendly.
   - Prioritize readable evidence summaries, clear filters, and copyable exports.
   - Avoid noisy dashboards, vanity metrics, or ranking/shaming UI.

9. Verification commands must pass before completion:

```bash
npm run typecheck
npm run lint
npm run build
```

If one of these commands fails, fix the issue. If it cannot be fixed in the current task, explain exactly what failed and why.

## Current feature task: Player Review Exporter

Implement an MVP feature that lets an officer select specific players, collect relevant data from recent Warcraft Logs reports, and generate a copy-pasteable ChatGPT prompt for player review.

The immediate use case is reviewing these players:

```txt
Fink, Katie, Bagge, Minischoles, Stu, Tashy, Ebri
```

The feature should support reviewing one player at a time first, then optionally generating prompts for the full preset group.

## Product goal

Create a repeatable, evidence-based player review workflow:

1. Select player.
2. Select recent reports and fights.
3. Fetch player-specific fight evidence.
4. Preview the evidence in the app.
5. Copy a structured ChatGPT prompt.
6. Optionally copy raw JSON for debugging or deeper analysis.

The app should gather and structure evidence. It should not directly label a player as good, bad, lazy, or at fault.

## Suggested route

Add:

```txt
/player-reviews
```

Add a navigation entry only if the existing app has an obvious nav pattern. Otherwise add the route and keep navigation changes minimal.

## Backend endpoints to add

Add these endpoints unless the existing route structure suggests a clearly better naming convention:

```txt
GET  /api/players/recent
POST /api/player-reviews/snapshot
POST /api/player-reviews/prompt
```

### `GET /api/players/recent`

Purpose:
- Build a unique list of players seen in recent guild reports.
- Include enough metadata to make player selection useful.

Suggested response:

```ts
export type RecentPlayer = {
  name: string
  className?: string | null
  specName?: string | null
  role?: 'tank' | 'healer' | 'dps' | 'unknown'
  reportCodes: string[]
  lastSeenAt?: number | null
}
```

### `POST /api/player-reviews/snapshot`

Purpose:
- Given a player and selected reports/fights, return a structured evidence pack.

Suggested request:

```ts
export type PlayerReviewSnapshotRequest = {
  playerName: string
  reportCodes: string[]
  fightIds?: number[]
  includeKills: boolean
  includeWipes: boolean
  includeTrash?: boolean
}
```

Suggested response:

```ts
export type PlayerReviewSnapshot = {
  player: {
    name: string
    className?: string | null
    specName?: string | null
    role?: 'tank' | 'healer' | 'dps' | 'unknown'
    possibleActorIds: number[]
  }
  reports: Array<{
    code: string
    title: string
    url: string
    startTime: number
  }>
  fights: PlayerFightSnapshot[]
  aggregate: {
    pullsReviewed: number
    killsReviewed: number
    wipesReviewed: number
    deaths: number
    earlyDeaths: number
    averageDps?: number | null
    averageHps?: number | null
    majorDamageTakenAbilities: Array<{
      abilityName: string
      count: number
      total: number
    }>
    defensiveUses: Array<{
      abilityName: string
      count: number
    }>
    interruptCount?: number | null
    dispelCount?: number | null
  }
  warnings: string[]
}

export type PlayerFightSnapshot = {
  reportCode: string
  fightId: number
  encounterName: string
  kill: boolean
  difficulty: number
  durationMs: number
  playerPresent: boolean
  playerDied: boolean
  deathTimeMs?: number | null
  throughput?: {
    damageDone?: number | null
    dps?: number | null
    healingDone?: number | null
    hps?: number | null
    activeTimePercent?: number | null
  }
  damageTaken: Array<{
    abilityName: string
    total: number
    hits: number
  }>
  deaths: Array<{
    timestampMs: number
    killingBlow?: string | null
    lastDamageEvents: Array<{
      secondsBeforeDeath: number
      abilityName: string
      amount: number
      sourceName?: string | null
    }>
    healingReceivedBeforeDeath: Array<{
      secondsBeforeDeath: number
      abilityName: string
      amount: number
      sourceName?: string | null
    }>
    defensiveBuffsActive?: string[]
  }>
  casts: Array<{
    abilityName: string
    count: number
  }>
  buffs: Array<{
    abilityName: string
    uptimePercent?: number | null
    applications?: number | null
  }>
  notes: string[]
}
```

### `POST /api/player-reviews/prompt`

Purpose:
- Generate a copy-pasteable prompt from a `PlayerReviewSnapshot`.
- This endpoint may also accept the same request as `/snapshot` and internally fetch the snapshot first if that fits the codebase better.

Suggested request:

```ts
export type PlayerReviewPromptRequest = {
  snapshot: PlayerReviewSnapshot
}
```

Suggested response:

```ts
export type PlayerReviewPromptResponse = {
  prompt: string
  snapshot: PlayerReviewSnapshot
}
```

Prompt generation may be implemented frontend-side instead if that is cleaner. Do not call the OpenAI API.

## Warcraft Logs data priorities

Implement in this order. Stop at the first useful MVP if WCL query complexity grows too much.

1. Player identity and participation
   - Resolve the player name to actor/source IDs per report.
   - Track whether the player was present in each fight.

2. Fight context
   - Encounter name
   - Fight ID
   - Kill/wipe
   - Difficulty
   - Duration
   - Report code and WCL URL

3. Death evidence
   - Death count
   - Timestamp of death relative to fight start
   - Killing blow where available
   - Last damage events before death where practical
   - Healing received shortly before death where practical

4. Damage taken
   - Top damage taken abilities per fight
   - Aggregate repeated damage taken abilities across selected fights

5. Survival usage
   - Defensive casts or active defensive buffs where practical
   - Healthstone/potion usage if readily available

6. Basic role/context metrics
   - DPS/HPS only as context, not as the main judgement signal
   - Interrupts/dispels if available without excessive query complexity

## Important WCL handling notes

- Treat WCL fight/event times carefully. Some report table/event times are relative to the report start, not Unix timestamps.
- Prefer fight-relative times in snapshots, such as `timestampMs` or `deathTimeMs` from fight start.
- Do not assume all fights have complete data.
- Do not fail the entire review if one report or fight query fails. Return warnings and partial evidence.
- Player names can be duplicated or vary by realm/server. Preserve possible actor IDs and report codes in the snapshot.

## Frontend feature structure

Add:

```txt
src/features/player-reviews/
├── api/
├── components/
├── containers/
├── hooks/
├── mappers/
├── services/
└── types/
```

Suggested files:

```txt
src/features/player-reviews/types/player-review-types.ts
src/features/player-reviews/api/player-review-rest-service.ts
src/features/player-reviews/services/player-review-service.ts
src/features/player-reviews/hooks/use-recent-players.ts
src/features/player-reviews/hooks/use-player-review-snapshot.ts
src/features/player-reviews/hooks/use-player-review-prompt.ts
src/features/player-reviews/containers/player-reviews-page.tsx
src/features/player-reviews/components/player-review-selector.tsx
src/features/player-reviews/components/player-review-evidence-preview.tsx
src/features/player-reviews/components/player-review-prompt-panel.tsx
```

Adapt names to match existing code conventions.

## UI requirements

The `/player-reviews` page should include:

- Player search/select.
- Preset group selector for:

```txt
Fink, Katie, Bagge, Minischoles, Stu, Tashy, Ebri
```

- Recent report multi-select.
- Fight filter:
  - all
  - kills only
  - wipes only
  - manually selected fights, if easy from existing report details
- Generate review pack button.
- Evidence preview with:
  - pulls reviewed
  - kills/wipes reviewed
  - deaths
  - repeated damage taken abilities
  - defensive/cast summary if available
  - per-fight rows
- Copy ChatGPT prompt button.
- Copy raw JSON button.
- WCL links for selected reports/fights where possible.
- Clear warnings when data is incomplete.

## Generated ChatGPT prompt template

Use this as the default generated prompt. Interpolate the selected player name and JSON snapshot.

```txt
You are reviewing Warcraft Logs data for a World of Warcraft raider.

Your job is to produce fair, evidence-based coaching feedback. Be direct but constructive. Do not insult the player. Do not overstate conclusions where the data is incomplete.

Player under review:
{{playerName}}

Context:
- These logs are from recent guild raid reports.
- Some fights are wipes and some may be kills.
- Focus on repeated patterns, not one-off mistakes.
- Separate facts from interpretation.
- When evidence is weak, say so.
- Treat wipe deaths carefully. A death during a wipe is not automatically a personal mistake.
- DPS/HPS numbers are context, not proof of good or bad play by themselves.
- Avoid comparing the player to rank 1 padding logs.
- Prioritize actionable improvements for the next raid.

Data:
{{jsonSnapshot}}

Please produce:

1. Executive summary
   - 3 to 5 bullet points on the player's main patterns.

2. Strengths
   - Mention anything the player appears to be doing well.

3. Biggest improvement areas
   - Prioritize the highest-impact issues.
   - Cite the specific fights, deaths, abilities, or repeated events from the data.

4. Death review
   - Summarize each death pattern.
   - Identify likely avoidable deaths.
   - Identify deaths that may be caused by raid-wide wipe conditions or lack of external support.

5. Defensive / survival usage
   - Did the player use personals, healthstone, potions, or relevant defensive tools?
   - Were they used before danger, late, or not at all?

6. Role-specific comments
   - If DPS: uptime, damage consistency, target/mechanic damage, avoidable damage taken.
   - If healer: deaths during healing pressure, dispels, cooldown usage, avoidable damage.
   - If tank: mitigation, taunt/swap issues, defensive coverage, spike damage.

7. Suggested feedback message to the player
   - Write this in a constructive Discord-friendly tone.
   - Keep it concise.
   - Include 2 to 3 specific things to work on next raid.

8. Officer-only notes
   - Anything the officer team should investigate manually in Warcraft Logs before speaking to the player.
```

## Review and ethics rules

- Never produce UI copy that mocks or shames players.
- Prefer labels like “needs manual review”, “possible issue”, and “repeated pattern” over definitive blame.
- Do not call a death avoidable unless the evidence supports it.
- Do not infer intent or effort from logs.
- Do not make private data leave the local app.
- Generated feedback should be constructive, specific, and Discord-friendly.

## Acceptance criteria

The task is complete when:

1. `/player-reviews` exists and renders.
2. The officer can select a player and one or more recent reports.
3. The app can generate a player review snapshot with at least fight context and death/damage-taken evidence.
4. The app can generate and copy a ChatGPT prompt containing the structured snapshot.
5. The feature handles missing/partial WCL data with warnings rather than crashing.
6. Secrets remain server-side.
7. No OpenAI API call is added.
8. `npm run typecheck`, `npm run lint`, and `npm run build` pass.

## Suggested implementation sequence

1. Add shared backend/frontend types for player review requests and responses.
2. Add backend WCL service methods for player discovery and player snapshot data.
3. Add `/api/players/recent`.
4. Add `/api/player-reviews/snapshot`.
5. Add prompt generation utility.
6. Add `/api/player-reviews/prompt` or frontend prompt generation.
7. Add frontend feature services/hooks.
8. Add `/player-reviews` route and page container.
9. Add evidence preview and copy buttons.
10. Run verification commands and fix issues.

## When in doubt

Choose the smallest working implementation that produces a useful, truthful player evidence pack and a high-quality copyable prompt. Favor correctness, privacy, and clear warnings over broad analysis.
