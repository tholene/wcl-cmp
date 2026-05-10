# BACKLOG — Warcraft Logs Guild Analyzer

Product owner: ChatGPT
Project: Local Warcraft Logs Guild Analyzer
Audience: Saves The Day guild log reviewer / raid officer
Status: Initial product backlog
Last updated: 2026-05-09

---

## Product goal

Build a private, local-first guild log-review assistant that helps officers and raiders answer:

1. What happened on this boss?
2. Who needs review and why?
3. What should each player improve next?
4. Are players improving over time?
5. Which roster gives the guild the best chance on a specific boss?

The app should not become a generic Warcraft Logs clone. It should become the guild’s coaching and raid-readiness layer on top of Warcraft Logs.

Core product loop:

```txt
Report → Boss → Fight → Player → Evidence → Action item → Trend over time
```

Important user requirement:

> Officers often want to inspect a specific boss across logs, not only a single raid night/report. Boss-first navigation must be treated as a core feature.

---

## Product principles

1. **Boss-first and player-first workflows are both first-class.**
   - Reports remain useful, but officers often think: “How are we doing on Boss X?”
   - Raiders often think: “Show me my own performance.”

2. **Evidence before advice.**
   - Every recommendation should be backed by timestamps, abilities, deaths, casts, or comparisons.

3. **Generic first, boss/spec-specific later.**
   - Start with high-confidence generic insights: deaths, cooldown counts, consumables, defensives, downtime, repeated damage patterns.
   - Add boss/spec modules after the review workflow is stable.

4. **Avoid misleading rankings.**
   - Do not reduce players to raw DPS/HPS or parse.
   - Separate throughput, survivability, mechanics, utility, consistency, and confidence.
   - Keep assignment context visible: free-DPS expectations differ from raid-leading and mechanic-assigned responsibilities.
   - Separate evidence, interpretation, and uncertainty in review output.

5. **Local-first and private.**
   - WCL credentials stay server-side.
   - No scraping WCL pages.
   - Use official Warcraft Logs v2 GraphQL API.
   - AI usage starts as copy-pasteable structured prompts before direct integration.

6. **Small, reviewable PRs.**
   - Each PR should have a clear scope, acceptance criteria, and actual verification output.
   - Side findings should become backlog items or GitHub issues, not hidden unrelated fixes.

7. **Success matrix before trusted scoring.**
   - Do not ship trusted raid-readiness/scoring recommendations before a shared success matrix exists.
   - Scoring must consume context-aware evidence categories, not raw parse/DPS/HPS alone.

---

## Current baseline

### 0.1 Recent Reports Dashboard

- **Status:** ✅ Done
- **Existing capability:** Fetches and displays recent guild reports.
- **Notes:** Keep this as the entry point, but it should no longer be the only primary navigation path.

### 0.2 Report Details View

- **Status:** ✅ Done
- **Existing capability:** Displays report metadata and fight table with encounter, kill/wipe status, difficulty, and duration.
- **Notes:** This becomes the launch point for fight review and player drilldown.

### 0.3 Server-owned WCL access

- **Status:** ✅ Done
- **Existing capability:** Express backend handles WCL OAuth client credentials and GraphQL calls.
- **Notes:** Maintain this boundary. Browser must never receive WCL secrets.

---

## Priority queue

1. **§1 Boss Overview Index** — boss-first navigation across recent reports/logs.
2. **§2 Fight Review Snapshot** — deaths, wipe signals, player drilldown from one fight.
3. **§3 Player Fight Review** — click player and see personal review with opener/cooldowns/survivability.
4. ✅ **§4 Structured AI Review Export** — copy-pasteable officer/player feedback prompts grounded in app metrics. (PR04)
5. **§5 Local Persistence Foundation** — SQLite cache and reviewed state.
6. **§6 Player Profiles and Trends** — player history, improvement/regression, action items.
7. **§7 Boss Progression Dashboard** — boss-specific history, best pulls, recurring wipe causes.
8. **§8 Cooldown and Opener Analyzer v1** — spec-configurable cooldown tracking and opener timeline.
9. **§9 Death and Wipe Pattern Analysis v1** — death clusters, repeated lethal events, contributing damage.
10. **§10 Review Workflow UX** — notes, reviewed flags, action items, Discord export.
11. **§11 Player Success Matrix and Evidence Packs** — context-aware evidence framework for player evaluation.
12. **§12 Guild Player Index / Raid Readiness** — transparent role-aware scoring that depends on §11.
13. **§13 Raid Team Builder** — boss-specific roster assistance.
14. **§14 Similar Log Benchmarking** — compare to self, guild peers, then public similar logs.
15. **§15 Spec/Boss Modules** — modular rules for specific specs and encounters.

---

# Backlog items

---

## §1 Boss Overview Index

- **Status:** ✅ Done
- **Priority:** P0
- **Suggested PR:** PR01
- **Feature type:** Product navigation / data aggregation
- **Notes:** 2026-05-07 — PR01 added boss-first navigation routes `/bosses` and `/bosses/:encounterId`, plus backend endpoints `GET /api/bosses/recent` and `GET /api/bosses/:encounterId/recent-fights`, with recent-report aggregation window messaging and drilldown links into report/fight review flows.

### Problem

Officers often want to review a specific boss across raid nights, not just inspect one report at a time. Current navigation starts from recent reports, then fights. This is useful, but not enough for progression review.

The app should support questions like:

- “How are people doing on Boss X?”
- “Show all recent pulls for Boss X.”
- “Who keeps dying on Boss X?”
- “Which players have improved on Boss X?”
- “What was our best pull on Boss X?”

### WCL data needed

- Recent guild reports.
- Report details for fights.
- Encounter ID and encounter name.
- Fight kill/wipe status.
- Fight difficulty.
- Fight start/end time.
- Fight duration.
- Report code/title/date.

### Generic or boss/spec-specific?

Generic. Uses encounter IDs and fight metadata only for MVP.

### MVP implementation approach

Add a boss index feature that groups fights by encounter across recent reports.

Suggested route structure:

```txt
/bosses
/bosses/:encounterId
```

Suggested backend endpoint options:

```txt
GET /api/bosses/recent
GET /api/bosses/:encounterId/recent-fights
```

MVP can aggregate from recent reports by fetching report details for the latest N reports. If this becomes slow or rate-limit prone, defer full optimization to §5 Local Persistence.

Data model suggestion:

```ts
type BossSummary = {
  encounterId: number
  encounterName: string
  pullCount: number
  killCount: number
  wipeCount: number
  lastSeenAt: number
  difficulties: number[]
  recentReports: Array<{
    code: string
    title: string
    startTime: number
  }>
}

type BossFightListItem = {
  reportCode: string
  reportTitle: string
  fightId: number
  encounterId: number
  encounterName: string
  kill: boolean
  difficulty: number
  startTime: number
  endTime: number
  durationMs: number
  url: string
}
```

### UI presentation

Add a primary nav item: **Bosses**.

`/bosses` should show cards or a table:

```txt
Boss              Pulls   Kills   Wipes   Last seen       Actions
Boss A            18      1       17      2026-05-05      View boss
Boss B            6       6       0       2026-05-05      View boss
```

`/bosses/:encounterId` should show:

- Boss name.
- Pull count.
- Kill/wipe ratio.
- Recent pulls table.
- Difficulty filter.
- Kill/wipe filter.
- Report/date filter if easy.
- Links to report details and future fight review pages.

### Pitfalls / misleading interpretations

- Recent report coverage may be incomplete if only the latest N reports are fetched.
- Boss names can change or be missing; encounter ID should be the primary key.
- Difficulty numbers should be mapped to readable labels only if the mapping is known and tested.
- Pull counts should state the time window, such as “latest 20 reports.”

### Acceptance criteria

- A user can open `/bosses` and see bosses grouped across recent reports.
- A user can click a boss and see recent pulls for that encounter.
- Each pull links back to the local report details page.
- The UI makes the aggregation window clear.
- No WCL secrets are exposed client-side.
- No scraping is introduced.
- Existing report dashboard and report details still work.

### Verification expected from Codex

Codex must run and report actual output/status:

```bash
npm run typecheck
npm run lint
npm run build
```

If tests exist or are added:

```bash
npm test
```

### Out of scope

- Death analysis.
- Player scoring.
- Local SQLite persistence unless required to make the feature usable.
- AI review.
- Public similar-log benchmarking.

---

## §2 Fight Review Snapshot

- **Status:** ✅ Done
- **Priority:** P0
- **Suggested PR:** PR02
- **Feature type:** Core review workflow
- **Notes:** 2026-05-07 — PR02 added fight review route `/reports/:code/fights/:fightId` and backend endpoint `GET /api/reports/:code/fights/:fightId/review`, including pull summary, participants, death timeline, recent damage evidence, and review shortlist. Player-specific review, AI prompts, persistence, and deeper death-pattern analysis remain in later backlog items.

### Problem

A fight row currently tells the officer whether it was a kill/wipe and how long it lasted. It does not answer what happened in the pull or who should be reviewed first.

### WCL data needed

- Fight metadata.
- Player participants.
- Death events.
- Damage taken events in the 10 seconds before each death.
- Final damage event per death.
- Optional: boss casts near death windows.

### Generic or boss/spec-specific?

Generic.

### MVP implementation approach

Add route:

```txt
/reports/:code/fights/:fightId
```

Add backend endpoint:

```txt
GET /api/reports/:code/fights/:fightId/review
```

MVP review payload:

```ts
type FightReview = {
  reportCode: string
  fightId: number
  encounterId: number
  encounterName: string
  kill: boolean
  difficulty: number
  startTime: number
  endTime: number
  durationMs: number
  participants: FightParticipant[]
  deaths: FightDeathSummary[]
}

type FightDeathSummary = {
  playerId: number
  playerName: string
  className?: string | null
  deathTime: number
  deathTimestampRelativeMs: number
  finalDamageEvent?: {
    abilityId: number
    abilityName: string
    sourceName?: string | null
    amount: number
  }
  recentDamageEvents: Array<{
    timestampRelativeMs: number
    abilityId: number
    abilityName: string
    sourceName?: string | null
    amount: number
  }>
}
```

### UI presentation

Fight review page sections:

1. **Pull Summary**
   - Encounter, difficulty, kill/wipe, duration.
   - Death count.
   - First death.

2. **Death Timeline**
   - Timestamp.
   - Player.
   - Final damage.
   - Expandable last 10 seconds before death.

3. **Participants**
   - Player list grouped by role/class if available.
   - Each row links to future player fight review page.

4. **Review Shortlist**
   - Players who died.
   - Players with multiple deaths if same player appears across pulls later.

### Pitfalls / misleading interpretations

- “Final damage” is not always the root cause.
- A player can die from unavoidable damage due to earlier avoidable damage.
- A wipe can be caused by a missed assignment that kills someone else.

Use wording like:

```txt
Final lethal damage: <ability>. Contributing damage in previous 10s: <events>.
```

Do not write:

```txt
Player caused wipe by failing <ability>.
```

### Acceptance criteria

- Fight rows have a **Review** action.
- Fight review page loads for a valid report/fight.
- Death timeline displays useful evidence.
- A fight with no deaths displays a clean empty state.
- Errors from WCL/API are handled without crashing the page.
- Existing report views remain unchanged except for the new Review link.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

Add unit tests for mappers/helpers if feasible.

### Out of scope

- AI-generated text.
- Spec rotation analysis.
- Boss-specific mechanic judgment.
- Player trend tracking.

---

## §3 Player Fight Review

- **Status:** ✅ Done
- **Priority:** P0
- **Suggested PR:** PR03
- **Feature type:** Raider self-review / officer drilldown
- **Notes:** 2026-05-10 — PR03 added player fight review route `/reports/:code/fights/:fightId/players/:playerId` and backend endpoint `GET /api/reports/:code/fights/:fightId/players/:playerId/review`, with assignment-context placeholder (`Unknown`), evidence categories aligned to §11 (context/output/execution/survivability/utility/consistency placeholder/confidence), deterministic findings with cautious wording, opener/casts activity, survivability/death evidence, recognized consumable/defensive/utility events where detectable, and confidence/limitations metadata for future §4 structured export and §11 evidence-pack consumption.

### Product owner note: evidence pack foundation

PR03 should preserve structured evidence so Player Fight Review becomes the first source for future evidence packs and the §11 success matrix.

Structured data should be preserved for:

- Output context.
- Cast execution.
- Cancelled casts / no-cast gaps if available.
- Cooldown usage.
- Survivability.
- Utility.
- Assignment context placeholder.
- Confidence / limitations.

MVP guidance:

- Assignment context may be `Unknown` in PR03.
- Manual assignment tagging belongs to a later PR.
- PR03 should not fake spec-specific advice before §15 Spec/Boss Modules exists.

### Problem

Raiders and officers need to click a player in a fight and get a concise, evidence-based review.

Primary user story:

> As a raider, I want to click a log, choose myself, and see what I should improve.

### WCL data needed

For selected report/fight/player:

- Player identity, class, spec if available.
- Cast events.
- Buff events.
- Debuff events.
- Damage done summary.
- Damage taken summary.
- Deaths.
- Interrupts.
- Dispels.
- Potion/healthstone/defensive casts.
- Major cooldown casts where configured.

### Generic or boss/spec-specific?

Generic MVP. Spec-specific cooldown definitions can be added incrementally.

### MVP implementation approach

Add route:

```txt
/reports/:code/fights/:fightId/players/:playerId
```

Add backend endpoint:

```txt
GET /api/reports/:code/fights/:fightId/players/:playerId/review
```

MVP sections:

- Overview.
- Deaths and recent damage.
- Consumables.
- Defensives.
- Major cooldowns if recognized.
- First 30–45 seconds opener timeline.
- Utility events: interrupts/dispels if present.
- Top findings generated by deterministic rules.

Suggested deterministic findings:

- No potion used.
- No healthstone used while dying or low health if detectable.
- Died with no defensive used in previous N seconds.
- Major cooldown first use delayed.
- Major cooldown count appears lower than fight length allowed.
- Long gap with no casts, if reliable.

### UI presentation

Player review page tabs or cards:

1. **Summary**
2. **Top Findings**
3. **Opener**
4. **Cooldowns**
5. **Survivability**
6. **Damage Taken**
7. **Utility**
8. **Raw Evidence**

### Pitfalls / misleading interpretations

- Cooldowns may be intentionally held for mechanics.
- Low activity can be caused by boss downtime or assigned movement.
- Healers and tanks require different interpretation from DPS.
- Spec-specific advice should not be faked before spec modules exist.

### Acceptance criteria

- User can open player review from a fight participant/death row.
- Page shows player name, fight, encounter, and duration.
- Page shows opener timeline for first 30–45 seconds.
- Page shows deaths and survivability evidence.
- Page shows deterministic top findings.
- Findings use cautious language where context may be missing.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

Add mapper/helper tests for finding generation if feasible.

### Out of scope

- Direct LLM integration.
- Public log comparison.
- Full spec rotation correctness.
- Player historical trend storage.

---

## §4 Structured AI Review Export

- **Status:** ✅ Done — PR04
- **Priority:** P1
- **Suggested PR:** PR04
- **Feature type:** AI-assisted review without direct AI integration
- **Notes:** 2026-05-07 — Product intent refined: the AI workflow is prompt generation for manual copy/paste into ChatGPT or another assistant, not direct LLM/API integration. Prompts must be evidence-rich, compact, and explicit about uncertainty. Future reference-log comparison belongs to later benchmarking/spec-module work, not the MVP.
- **Delivered:** 2026-05-10 — Frontend-only. Added `player-ai-review-export.ts` (pure prompt builders), `player-ai-review-export-card.tsx` (copy UX), wired into Player Fight Review page after header. Three exports: officer prompt, player feedback prompt, structured JSON.

### Problem

AI can help turn log evidence into coaching language, but only if grounded in structured data. Raw event dumps encourage hallucinated or misleading advice.

The app should not ask an AI to browse Warcraft Logs, infer missing context, or guess from vague summaries. Instead, the app should gather WCL-derived evidence itself, summarize that evidence clearly, and produce prompts that are useful when pasted manually into ChatGPT or another AI assistant.

### Product intent / PO note

The intended AI workflow is **prompt generation**, not direct LLM/API integration.

Users should be able to click actions such as:

- **Generate AI prompt**
- **Copy player analysis prompt**
- **Copy fight insight prompt**
- **Copy officer review prompt**
- **Copy player feedback prompt**

The app should gather the relevant Warcraft Logs evidence, convert it into a structured and compact prompt, and let the user paste that prompt into ChatGPT or another AI assistant manually.

This keeps the product local-first and avoids storing, managing, or transmitting OpenAI/LLM API keys in the app. A ChatGPT Pro subscription or similar consumer AI product can be used manually through copy/paste, but should not be treated as backend API access.

The long-term goal is for generated prompts to be evidence-rich enough to support meaningful player coaching, for example:

- how a selected player performed on a selected fight;
- what deaths, avoidable damage, missed cooldowns, consumable gaps, opener issues, or utility gaps are visible;
- what the player should prioritize improving next;
- what uncertainty remains because the app does not yet have boss/spec-specific context.

Generated prompts should include all necessary context and data so the AI does not need to browse Warcraft Logs or guess. Raw event dumps should be avoided where possible; summarized, timestamped evidence is preferred.

### WCL data needed

No new WCL data beyond §2 and §3 review payloads for the MVP.

The prompt builder should consume already-derived review data such as:

- fight metadata;
- participant/player identity;
- death summaries;
- recent damage before death;
- deterministic findings;
- cooldown, defensive, consumable, opener, and utility summaries when available;
- known limitations from the analyzer.

Future comparative prompts may depend on §14 Similar Log Benchmarking and §15 Spec/Boss Modules.

### Generic or boss/spec-specific?

Generic for the MVP.

Prompt templates should include a clear limitations section when boss/spec-specific context is not available. Later versions can enrich prompts with spec/boss modules and reference-log comparisons.

### MVP implementation approach

On the Player Fight Review page, add copy actions:

- **Copy officer review prompt**
- **Copy player feedback prompt**
- **Copy structured JSON**
- **Copy Discord summary**

If PR04 also has access to a fight-level review payload, it may add a fight-level action:

- **Copy fight insight prompt**

The generated prompt should include:

- Encounter.
- Difficulty.
- Fight duration.
- Result.
- Report/fight identifiers.
- Player/class/spec where relevant.
- Death evidence.
- Cooldown/defensive/consumable findings.
- Opener summary where available.
- Utility evidence where available.
- Deterministic top findings from the app.
- Known limitations and uncertainty.
- Tone instruction.

Prompt must explicitly instruct the AI to:

- Be constructive.
- Avoid shaming.
- Mention uncertainty.
- Prioritize 2–3 improvements.
- Reference evidence/timestamps.
- Separate evidence from interpretation.
- Avoid inventing boss strategy, spec rules, or blame not present in the provided data.

### Future comparative analysis direction

A later version can improve prompt quality by adding reference-log benchmarking **before** prompt generation.

For a selected player/fight, the app could discover comparable high-performing logs for the same boss, difficulty, class/spec, patch, and similar fight length/item-level bracket where available. It could then extract normalized comparison metrics such as:

- casts per minute;
- major cooldown first-use timing and total uses;
- buff/debuff uptime;
- opener sequence;
- potion/consumable usage;
- defensive usage before dangerous events;
- avoidable damage taken;
- deaths and death causes;
- active time/downtime;
- utility usage such as interrupts or dispels.

The AI prompt would then compare the selected player against summarized reference medians/ranges rather than asking the AI to infer from raw logs.

This is explicitly **out of scope for the §4 MVP** and may depend on §14 Similar Log Benchmarking and §15 Spec/Boss Modules.

### UI presentation

Add an **AI Review Export** card on player review page.

Use copy buttons with success toasts.

Suggested UI sections inside the card:

- Officer prompt.
- Player-friendly prompt.
- Structured JSON.
- Discord summary.
- Known limitations included in prompt.

The UI should make it clear that the app is copying a prompt for manual use, not sending data to an AI service.

### Pitfalls / misleading interpretations

- AI must not infer boss strategy that is not present in the structured data.
- Officer-facing and player-facing language should be separate.
- Do not include secrets, tokens, or unnecessary raw data.
- Do not include large raw event dumps when summarized evidence is enough.
- Do not imply that ChatGPT Pro or another consumer subscription provides API access to this local app.
- Do not present future reference-log comparisons as if they exist in the MVP.

### Acceptance criteria

- User can copy an officer prompt.
- User can copy a player-friendly prompt.
- User can copy raw structured JSON.
- User can copy a short Discord-friendly summary if the source review data is available.
- Generated prompts include enough structured WCL-derived data to be useful when pasted into ChatGPT manually.
- Prompt generation does not require, store, or call any OpenAI/LLM API key.
- Prompt text clearly distinguishes evidence, interpretation, and uncertainty.
- Prompt text includes known analyzer limitations.
- Prompt text instructs the AI not to invent missing boss/spec context.
- Future reference-log comparison is documented as a later enhancement, not part of the MVP.
- No direct API keys or LLM integration are introduced.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

If prompt-building helpers are introduced, add unit tests if a test framework exists by then. If no test framework exists, manually verify generated prompt output and include representative non-sensitive prompt excerpts in the handoff.

### Out of scope

- Direct OpenAI/LLM API integration.
- Storing or managing OpenAI/LLM API keys.
- Treating ChatGPT Pro or another consumer subscription as API access.
- Saving generated AI responses.
- Discord bot integration.
- Public/reference-log comparison in the §4 MVP.
- Similar-log discovery or benchmarking unless already delivered by §14.

---

## §5 Local Persistence Foundation

- **Status:** 🔴 Not done
- **Priority:** P1
- **Suggested PR:** PR05
- **Feature type:** Infrastructure / product memory

### Problem

Without persistence, the app cannot track players over time, avoid repeated WCL calls, remember reviewed fights, or build boss-specific history.

### WCL data needed

Persist summarized data fetched by existing and new endpoints:

- Reports.
- Fights.
- Boss/encounter metadata.
- Players.
- Fight participants.
- Death summaries.
- Player fight summaries.
- Analysis JSON.
- Review status.

### Generic or boss/spec-specific?

Generic.

### MVP implementation approach

Add SQLite with a minimal schema. Prefer a lightweight migration approach that fits the current local app.

Suggested tables:

```txt
reports
fights
encounters
players
fight_participants
fight_death_summaries
player_fight_summaries
review_notes
action_items
analysis_cache
```

Suggested first-principles:

- Store report/fight/player IDs using WCL identifiers where possible.
- Store normalized columns for common filters.
- Store raw or semi-structured `analysisJson` for evolving analyzer output.
- Add `lastFetchedAt` / `lastAnalyzedAt` timestamps.

### UI presentation

- Show cached/analyzed status on reports/fights.
- Add “Refresh from WCL” action if feasible.
- Add reviewed/unreviewed status placeholders for future workflow.

### Pitfalls / misleading interpretations

- Do not over-normalize early analyzer data.
- Do not cache secrets.
- Be explicit about stale data.
- Avoid DB migration complexity larger than needed for local-first POC.

### Acceptance criteria

- App can start with a local SQLite DB.
- Existing report/fight flows still work.
- Basic report/fight/player summaries can be persisted.
- Re-running analysis does not create duplicate rows.
- No secrets are written to DB.
- Migration/init behavior is documented.

### Verification expected from Codex

Codex must document DB setup and run actual verification. Expected baseline:

```bash
npm run typecheck
npm run lint
npm run build
```

If migration/generate scripts are added, Codex must run them and include actual output/status.

### Out of scope

- Full historical import of all guild logs.
- Advanced roster scoring.
- Direct AI response persistence unless small and justified.

---

## §6 Player Profiles and Trends

- **Status:** 🔴 Not done
- **Priority:** P1
- **Suggested PR:** PR06
- **Feature type:** Longitudinal analytics

### Problem

Officers need to know whether players are improving, regressing, consistent, or repeatedly failing the same type of mechanic.

### WCL data needed

From persisted summaries:

- Player appearances.
- Encounter participation.
- Death counts.
- Consumable usage.
- Defensive usage.
- Major cooldown summaries.
- Role/spec over time.
- Performance metrics where available.

### Generic or boss/spec-specific?

Generic with boss filters.

### MVP implementation approach

Add routes:

```txt
/players
/players/:playerId
```

Player profile should show:

- Recent fights.
- Bosses played.
- Specs/roles used.
- Death rate.
- Consumable usage rate.
- Recent review notes.
- Open action items.
- Trend indicators with confidence labels.

### UI presentation

Player profile tabs:

- Overview.
- Recent Fights.
- Boss History.
- Deaths.
- Cooldowns.
- Notes.
- Action Items.

### Pitfalls / misleading interpretations

- Low sample size can mislead.
- Role/spec swaps must be separated.
- Farm kills and progression wipes should not be mixed blindly.

### Acceptance criteria

- User can browse players seen in cached logs.
- User can open a player profile.
- Profile shows recent boss/fight history.
- Basic trend indicators include sample size/confidence.
- Profile links back to source fights/reports.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

### Out of scope

- Public log comparison.
- Full raid team builder.
- Spec-specific rotation scoring.

---

## §7 Boss Progression Dashboard

- **Status:** 🔴 Not done
- **Priority:** P1
- **Suggested PR:** PR07
- **Feature type:** Boss-first progression analysis

### Problem

The Boss Overview Index shows pulls. Officers also need a boss-specific progression dashboard answering:

- Are we improving on this boss?
- What are the most common death events?
- Which players have repeated issues on this boss?
- Which pull was closest/best?

### WCL data needed

- Persisted boss fights.
- Kill/wipe status.
- Pull durations.
- Death summaries.
- Encounter progress/boss percentage if available.
- Player participation.

### Generic or boss/spec-specific?

Generic MVP. Boss-specific interpretations later.

### MVP implementation approach

Enhance `/bosses/:encounterId` with analytics cards:

- Pulls over time.
- Kill/wipe summary.
- Longest pulls.
- Most recent pulls.
- Most common lethal abilities.
- Players with repeated deaths on this boss.
- Personal best pull length or boss percentage if available.

### UI presentation

Boss page sections:

1. Boss summary.
2. Recent pulls table.
3. Pull trend.
4. Death patterns.
5. Player review shortlist.

### Pitfalls / misleading interpretations

- Longest pull is not always best pull if boss phase progression differs.
- Repeated lethal ability is not always avoidable.
- Different difficulties should be filterable and not blended silently.

### Acceptance criteria

- Boss page supports difficulty and kill/wipe filters.
- Boss page summarizes repeated death events.
- Boss page highlights players/fights worth review.
- All analytics link back to evidence.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

### Out of scope

- Boss-specific strategy judgments.
- Raid roster recommendations.

---

## §8 Cooldown and Opener Analyzer v1

- **Status:** 🔴 Not done
- **Priority:** P2
- **Suggested PR:** PR08
- **Feature type:** Player coaching analysis

### Problem

Raiders want to know whether their opener and major cooldown usage match reasonable expectations.

### WCL data needed

- Cast events.
- Buff apply/remove events.
- Fight duration.
- Player class/spec.
- Bloodlust/Heroism timing if available.
- Potion events.
- Configured cooldown spell IDs.

### Generic or boss/spec-specific?

Analyzer framework generic; spell configs spec-specific.

### MVP implementation approach

Add a local config file for recognized cooldowns and defensives.

Example:

```ts
type SpecCooldownConfig = {
  className: string
  specName: string
  majorCooldowns: SpellDefinition[]
  defensives: SpellDefinition[]
  coreBuffs: SpellDefinition[]
}
```

For each recognized cooldown, calculate:

- First use.
- Use count.
- Possible use count based on fight duration and cooldown length.
- Longest delay after cooldown was available.
- Used in opener yes/no.
- Aligned with potion/lust if determinable.

### UI presentation

Player review page:

```txt
Cooldown       First use   Uses   Possible   Notes
Ability A      00:03       3      3          Good
Ability B      00:52       2      3          First use delayed
```

Opener timeline:

```txt
00:00 Pull
00:01 Potion
00:02 Major CD
00:03 Ability A
```

### Pitfalls / misleading interpretations

- Cooldowns can be intentionally held.
- Boss downtime affects possible uses.
- External assignments can alter opener.
- Incorrect spell IDs can create false findings.

### Acceptance criteria

- At least one spec/class config is implemented as proof of concept.
- Unknown specs still show generic casts/opener without false advice.
- Findings use cautious language.
- Config structure supports adding more specs later.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

Add unit tests for cooldown count logic.

### Out of scope

- Full spec rotation simulator.
- Rank 1/top log comparison.
- All class/spec coverage.

---

## §9 Death and Wipe Pattern Analysis v1

- **Status:** 🔴 Not done
- **Priority:** P2
- **Suggested PR:** PR09
- **Feature type:** Wipe analysis

### Problem

Officers need to quickly identify repeated wipe/death patterns across pulls.

### WCL data needed

- Death events.
- Damage taken before death.
- Debuffs before death.
- Boss casts around death clusters.
- Fight result and duration.

### Generic or boss/spec-specific?

Generic MVP.

### MVP implementation approach

Add analysis to fight and boss pages:

- First death per wipe.
- Death clusters within 5–10 seconds.
- Repeated lethal abilities.
- Repeated contributing abilities.
- Deaths with no recent defensive usage if defensive config exists.

### UI presentation

- Death cluster timeline.
- Repeated ability table.
- “Possible recurring issue” card.
- “Needs manual review” labels.

### Pitfalls / misleading interpretations

- Correlation is not responsibility.
- The dead player may not be the player who failed.
- Some mechanics intentionally sacrifice players.

### Acceptance criteria

- Fight review identifies death clusters.
- Boss dashboard aggregates repeated lethal/contributing events.
- UI avoids blame language.
- Analysis is linked to source fights/deaths.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

### Out of scope

- Boss-specific mechanic responsibility.
- Automated blame assignment.

---

## §10 Review Workflow UX

- **Status:** 🔴 Not done
- **Priority:** P2
- **Suggested PR:** PR10
- **Feature type:** Officer workflow

### Problem

The tool should help manage the weekly review process, not just display analysis.

### WCL data needed

No new WCL data. Depends mostly on local persistence.

### Generic or boss/spec-specific?

Generic.

### MVP implementation approach

Add local workflow fields:

- Report reviewed state.
- Fight reviewed state.
- Player reviewed state.
- Officer notes.
- Player-facing feedback.
- Action items.
- Action item status.

### UI presentation

- Review Queue dashboard.
- Notes panel on fight/player pages.
- Action items on player profiles.
- Copy Discord feedback button.

### Pitfalls / misleading interpretations

- Keep private officer notes clearly separate from player-facing feedback.
- Avoid UI that encourages public shaming.

### Acceptance criteria

- Officer can mark report/fight/player as reviewed.
- Officer can create and resolve action items.
- Officer notes persist locally.
- Player-facing feedback can be copied separately.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

If DB schema changes, migration/init verification is required.

### Out of scope

- Discord bot posting.
- Multi-user auth.
- Cloud sync.

---

## §11 Player Success Matrix and Evidence Packs

- **Status:** 🔴 Not done
- **Priority:** P1
- **Suggested PR:** PR11+
- **Feature type:** Officer decision support / player evaluation framework

### Problem

Officers need a consistent way to evaluate players without taking raw DPS/HPS/parse numbers at face value.

The app should help answer:

- What evidence supports this player feedback?
- Was the player assigned special mechanics or free to maximize damage?
- Is the issue throughput, execution, survivability, utility, consistency, or context?
- Is the finding repeated or based on one pull?
- How confident are we?

### Product intent

Define a shared success matrix with visible categories:

1. Context
2. Output
3. Execution
4. Survivability
5. Utility / assignments
6. Consistency / trend
7. Confidence

The MVP should not produce a single opaque score. It should keep evidence, interpretation, and uncertainty explicit.

### WCL data needed

- Fight metadata.
- Player identity, class/spec, role if available.
- Cast events.
- Cancelled/interrupted cast events if available.
- Damage done by target.
- Damage taken.
- Death summaries.
- Buff/debuff events.
- Interrupts/dispels.
- Cooldown casts.
- Potion/healthstone/defensive casts.
- Fight participants for guild peer comparison.

### Manual/local data needed later

- Assignment tags.
- Raid leader / shotcaller tags.
- Officer notes.
- Review action items.

### Generic or boss/spec-specific?

Generic framework first. Later enrichment can come from §14 Similar Log Benchmarking and §15 Spec/Boss Modules.

### MVP implementation approach

- Extend player/fight review payloads to keep matrix-ready evidence categories explicit.
- Use cautious labels and confidence markers rather than hidden weighted scoring.
- Keep assignment context as explicit `Unknown` when no assignment data exists.
- Ensure downstream scoring/readiness work consumes this matrix instead of bypassing it.

### Example use case: Frost Mage review

Use this as a product direction example, not immediate implementation scope.

Potential evidence dimensions:

- Cancelled casts per minute.
- Active time / downtime.
- Longest no-cast gaps.
- Opener sequence.
- Major cooldown timing.
- Defensive usage such as Mirror Image before predictable damage.
- Boss vs add/padding damage split.
- Comparison against guild frost mage cohort.

Mirror Image should be treated cautiously. It can be a defensive planning signal, but low severity unless tied to deaths, dangerous damage windows, or repeated missed defensive opportunities.

### UI presentation

Player/fight review should present matrix categories side-by-side with evidence snippets and confidence labels.

Suggested pattern:

```txt
Category      Evidence summary                     Confidence
Context       Assignment unknown; RL tag missing   Low
Execution     3 long no-cast gaps; 7 cancels       Medium
Survivability Died twice after avoidable damage    Medium
```

### Pitfalls / misleading interpretations

- Raw DPS/HPS can be misleading.
- Padding may be acceptable or expected for unassigned DPS players depending on strategy.
- Assigned players, raid leaders, and mechanic handlers need context-aware evaluation.
- Cancelled casts may indicate poor movement planning, but can also be caused by mechanics.
- Defensive usage can be minor unless tied to actual damage events.
- Do not infer assignment responsibility without explicit data or officer tags.

### Acceptance criteria

- Backlog defines a shared success matrix with explicit categories.
- Matrix framing clearly states raw parse/DPS/HPS is insufficient for officer decisions.
- Evidence, interpretation, and uncertainty are explicitly separated.
- Assignment context is represented and can remain `Unknown` in MVP.
- Guild peer comparison can be incorporated without reducing review to one opaque number.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

### Out of scope

- Implementing success matrix UI.
- Implementing cancelled-cast analyzers.
- Frost mage-specific module logic.
- Mirror Image scoring logic.
- Direct scoring algorithm changes in this docs-only PR.

---

## §12 Guild Player Index / Raid Readiness

- **Status:** 🔴 Not done
- **Priority:** P3
- **Suggested PR:** PR12
- **Feature type:** Roster support / scoring

### Dependency note

This item must consume §11 Player Success Matrix and Evidence Packs as its input model. It must not score players solely from raw DPS/HPS/parse and should remain transparent and role-aware.

### Problem

Raid officers need help choosing strong teams, but raw parses are too misleading. The app should provide transparent role-aware readiness indicators.

### WCL data needed

Across persisted fights:

- Player attendance.
- Role/spec history.
- Boss experience.
- Death rate.
- Avoidable/repeated damage signals.
- Cooldown discipline.
- Consumable usage.
- Throughput metrics.
- Utility usage.
- Recent trend.

### Generic or boss/spec-specific?

Generic score framework with boss-specific filters.

### MVP implementation approach

Do not start with one magic number. Start with subscores:

- Throughput.
- Survivability.
- Mechanics.
- Utility.
- Consistency.
- Improvement trend.
- Attendance.
- Confidence.

Add confidence based on sample size.

### UI presentation

Roster/players table:

```txt
Player       Role   Readiness   Trend   Confidence   Notes
Player A     DPS    84          ↑       High         Strong, low deaths
Player B     DPS    71          ↑       Medium       Improving, potion issue
```

Use badges:

- Reliable.
- Improving.
- Needs review.
- High death risk.
- Low sample size.

### Pitfalls / misleading interpretations

- Socially sensitive: avoid “bad player score.”
- Do not over-weight raw DPS/HPS.
- Tanks/healers/DPS need different scoring.
- Assignment context matters.

### Acceptance criteria

- Player index displays transparent subscores.
- Score can be filtered by boss/difficulty/time window.
- Low sample size is clearly labeled.
- Score components link back to evidence where possible.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

### Out of scope

- Auto-benching decisions.
- Hidden opaque scoring.
- Public sharing.

---

## §13 Raid Team Builder

- **Status:** 🔴 Not done
- **Priority:** P3
- **Suggested PR:** PR13
- **Feature type:** Raid planning

### Problem

The raid lead wants to form the strongest possible team for a specific boss while considering role balance, utility, recent performance, and reliability.

### WCL data needed

- Player readiness subscores.
- Boss-specific player history.
- Role/spec/class.
- Attendance/availability input.
- Utility mapping by class/spec.

### Generic or boss/spec-specific?

Boss-specific output, generic framework.

### MVP implementation approach

Manual availability first. No calendar/signup integration yet.

Inputs:

- Boss.
- Difficulty.
- Available players.
- Desired raid size.
- Tank/healer/DPS constraints.
- Optional locked players.

Output:

- Suggested roster.
- Role counts.
- Utility coverage.
- Readiness warnings.
- Low-confidence warnings.
- Manual override support.

### UI presentation

```txt
Boss: <Boss X>
Available: 24 players
Target roster: 20

Suggested roster:
Tanks: ...
Healers: ...
Melee: ...
Ranged: ...

Comp notes:
- Battle res covered
- Missing raid buff X
- High melee count warning
- Player Y has repeated deaths to Ability Z on this boss
```

### Pitfalls / misleading interpretations

- Do not present suggestions as final decisions.
- Bench decisions are socially sensitive.
- Utility mappings must be maintained across patches.

### Acceptance criteria

- User can select boss and available players.
- Tool suggests a roster using transparent criteria.
- User can override suggestions.
- Output explains tradeoffs and warnings.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

### Out of scope

- Automatic Discord signup integration.
- Loot council integration.
- Perfect optimization solver.

---

## §14 Similar Log Benchmarking

- **Status:** 🔴 Not done
- **Priority:** P4
- **Suggested PR:** PR14+
- **Feature type:** Advanced comparison

### Dependency note

Benchmarking outputs should feed matrix categories in §11 (context, output, execution, survivability, utility, consistency, confidence) rather than becoming parse-only ranking shortcuts.

### Problem

Players want to know what stronger players did differently, especially in opener, cooldown timing, talents, gear, and target priority.

### WCL data needed

For comparable logs:

- Encounter.
- Difficulty.
- Spec.
- Item level if available.
- Fight duration.
- Kill logs.
- Cast counts.
- Cooldown timings.
- Buff uptimes.
- Talents/gear if available.
- Damage target distribution.

### Generic or boss/spec-specific?

Spec-specific and encounter-specific.

### MVP implementation approach

Start with safer comparisons:

1. Player vs their own best historical log.
2. Player vs guild peers of same spec/role.
3. Player vs selected external public logs later.

Do not compare to rank 1 logs by default.

### UI presentation

Player review comparison tab:

- Latest vs personal best.
- Latest vs guild median.
- Latest vs selected benchmark.
- Opener diff.
- Cast count diff.
- Cooldown timing diff.
- Gear/talent diff if available.

### Pitfalls / misleading interpretations

- Top logs can involve padding, unusual strategies, external buffs, or very different kill times.
- Gear/talent differences do not automatically mean a player should copy them.
- Public comparisons can be expensive/rate-limited.

### Acceptance criteria

- User can compare a player log to their own historical best.
- Comparison explains matching criteria and limitations.
- UI avoids “copy top parse blindly” messaging.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

### Out of scope

- Full public benchmark search in first version.
- Gear simulation.
- Automated BiS recommendations.

---

## §15 Spec/Boss Modules

- **Status:** 🔴 Not done
- **Priority:** P4
- **Suggested PR:** PR15+
- **Feature type:** Expert rules / analyzer plugins

### Dependency note

Spec/boss modules should enrich success-matrix evidence quality and confidence, not bypass matrix categories with opaque judgments.

### Problem

Generic analysis finds common problems, but high-value coaching eventually needs spec-specific and boss-specific knowledge.

### WCL data needed

Depends on module:

- Spec casts/buffs/resources.
- Boss ability timings.
- Debuffs.
- Damage taken.
- Positioning if supported and useful.

### Generic or boss/spec-specific?

Specific by design.

### MVP implementation approach

Create a plugin/module interface before adding many rules.

Example:

```ts
type AnalyzerModule = {
  id: string
  label: string
  appliesTo(context: AnalysisContext): boolean
  analyze(context: AnalysisContext): AnalysisFinding[]
}
```

Start with one low-risk module, such as:

- A single DPS spec cooldown module.
- A single boss recurring death mechanic module.

### UI presentation

Findings should appear in the same Top Findings system, tagged by source module.

### Pitfalls / misleading interpretations

- Patch changes can invalidate rules.
- Spell IDs and mechanics can vary.
- Bad expert rules are worse than no rule.

### Acceptance criteria

- Analyzer module interface exists.
- At least one module works end-to-end.
- Modules can be disabled or ignored if stale.
- Findings include source module and confidence.

### Verification expected from Codex

```bash
npm run typecheck
npm run lint
npm run build
```

Add tests for module applicability and output.

### Out of scope

- Broad all-spec coverage.
- Full boss guide replacement.

---

# Codex PR working rules

Use these rules for every implementation PR.

## Branching

Create a new branch from current main:

```bash
git fetch origin
git checkout main
git pull --ff-only origin main
git checkout -b prXX-short-feature-name
```

If the project uses another base branch, use the actual project default.

## Scope control

Each PR must be focused on one backlog item or a clearly stated subpart of one backlog item.

Do not include unrelated refactors, formatting sweeps, package-manager changes, deployment work, or broad cleanup unless required for the feature.

If Codex finds a side issue:

1. Decide whether it blocks the PR.
2. If non-blocking, do not fix it in the PR.
3. Create a GitHub issue if tooling/access exists.
4. If issue creation is unavailable, include an issue draft in handoff.
5. Add or update a backlog follow-up if it affects product direction.

## Architecture expectations

Inspect actual repo structure first.

Current likely areas:

```txt
src/components
src/features/reports
src/lib
server/index.ts
server/warcraft-logs
```

Expected pattern for new frontend features:

```txt
src/features/<feature>/api
src/features/<feature>/components
src/features/<feature>/containers
src/features/<feature>/hooks
src/features/<feature>/mappers
src/features/<feature>/services
src/features/<feature>/types
```

Prefer existing shared primitives and layout components over one-off local wrappers.

For API-facing feature code, prefer a consistent 3-layer pattern where appropriate:

```txt
Rest/API client → Service → Hook
```

Keep WCL access server-side.

## Security requirements

- No WCL secrets in frontend code.
- No secrets in logs, API responses, docs, screenshots, handoff, or test fixtures.
- Use WCL v2 GraphQL API only; do not scrape Warcraft Logs pages.
- Config status endpoints must never reveal secret values.
- Error responses should be useful but not leak credentials or tokens.
- Any future test-only provider/header/env must be explicitly guarded and documented.

## Database / migration requirements

If a PR changes persistence:

- Document the schema/model changes.
- Document migration/init behavior.
- Run and report actual migration/generate/init verification.
- State whether existing local DBs need reset or migration.
- Never store WCL client secret, access token, or other secrets in SQLite.

If no DB change is expected, PR instructions should say:

```txt
No DB migration expected. If Codex finds one is required, justify it and verify it explicitly.
```

## Expected verification

At minimum, every PR should run and report actual status/output:

```bash
npm run typecheck
npm run lint
npm run build
```

If tests exist or are added:

```bash
npm test
```

If backend-specific tests/scripts are introduced, run them too.

The PR handoff must not only list commands. It must report actual results, for example:

```md
- ✅ `npm run typecheck` — passed
- ✅ `npm run lint` — passed
- ✅ `npm run build` — passed; Vite build completed successfully
```

## Grep / safety sweeps

For PRs touching auth, config, WCL credentials, tokens, persistence, or logging, run relevant grep sweeps and explain remaining hits.

Suggested examples:

```bash
grep -R "WCL_CLIENT_SECRET\|WCL_CLIENT_ID\|access_token\|Authorization" src server .env.example README.md docs 2>/dev/null
```

Remaining hits must be explained. Real secrets must never appear.

## PR handoff format

Codex final handoff should include:

```md
## Summary

## What changed

## What explicitly did not change

## Verification

## DB / migration status

## Security / grep sweeps

## Side findings / issues

## Known gaps / follow-ups
```

## Suggested PR description format

```md
## Summary

<short summary>

## What changed

- <point>
- <point>
- <point>

## Scope note

<what this PR intentionally does not do>

## Verification

- ✅ `<command>` — <actual result>
- ✅ `<command>` — <actual result>

## Security / safety

- <grep sweep result if relevant>

## Follow-ups

- <issue/backlog item if relevant>
```

---

# Changelog

- **2026-05-07** — Created initial product backlog for Warcraft Logs Guild Analyzer.
- **2026-05-07** — Added boss-first workflow as P0 based on officer need to review specific bosses across logs.
- **2026-05-07** — Refined §4 Structured AI Review Export: prompt-generation-first workflow, no direct LLM/API integration, evidence-rich manual ChatGPT prompts, and future reference-log benchmarking documented as later work.
- **2026-05-07** — §2 Fight Review Snapshot: added fight-level pull review instructions / implementation follow-up.
- **2026-05-09** — Added Player Success Matrix and Evidence Packs backlog item based on officer feedback about context-aware player evaluation.
