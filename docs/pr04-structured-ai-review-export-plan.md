# PR04 Plan — Structured AI Review Export

Status: **Delivered** (PR04 2026-05-10)
Date: 2026-05-10
Planner: Cline

## PR05 update (2026-05-10)

Officer and player feedback prompts were restructured in PR05. Both now request a 5-section response format:
- Officer: Visible signals → Potential concerns → Analyzer limitations → Manual WCL checks → Suggested player-facing feedback
- Player: What went well → Areas to look at → Data gaps → Suggested checks → Actionable suggestions

Guardrails updated to tell the AI to lead with signals (not caveats), distinguish "system gap" from "player mistake," and avoid judging performance without strong evidence.

## Goal

Add copy-pasteable AI review exports on the Player Fight Review page, using existing PR03 evidence payloads. Users manually paste prompts into ChatGPT (or similar).

## Current branch and git status (at planning time)

- Branch: `main`
- `git status --short`: clean working tree (no output)

## Relevant observations

- `BACKLOG.md` §4 defines prompt-generation (manual copy) workflow and explicitly avoids direct LLM integration.
- `docs/player-fight-review.md` confirms PR03 is the structured evidence foundation for §4 and §11.
- Player route already exists: `/reports/:code/fights/:fightId/players/:playerId`.
- `PlayerFightReview` payload already includes:
  - fight context (encounter, difficulty, result, duration, IDs)
  - player identity (name/class/type; spec not explicit)
  - assignment context (`Unknown`)
  - evidence categories (context/output/execution/survivability/utility/consistency/confidence)
  - deaths/survivability evidence
  - opener/casts/activity evidence
  - defensive/consumable and utility evidence where detectable
  - top findings
  - limitations/partial-source metadata
- No existing clipboard/toast abstraction in UI.

## Architecture approach

Frontend-only prompt generation is preferred for PR04 because:

- It only uses already-returned review payloads
- It requires no secrets
- It keeps local-first boundaries intact

No backend/WCL changes are required for core PR04.

## Proposed files

### Add

- `src/features/players/utils/player-ai-review-export.ts`
  - pure helpers:
    - `buildOfficerReviewPrompt(review)`
    - `buildPlayerFeedbackPrompt(review)`
    - `buildStructuredPlayerReviewJson(review)`
- `src/features/players/components/player-ai-review-export-card.tsx`
  - copy actions + copied/error confirmation
- `docs/structured-ai-review-export.md` (post-implementation feature doc)

### Change

- `src/features/players/components/player-fight-review-page.tsx`
  - insert new AI export card near top of page
- `BACKLOG.md`
  - mark §4 done after implementation and add PR note
- optional note in `docs/player-fight-review.md` linking PR04 docs

### Likely unchanged

- `src/lib/routes.ts`
- `src/lib/query-keys.ts`
- `server/warcraft-logs/wcl-types.ts`
- backend service/controller files for core scope

## Prompt/export structure

Support at least:

1. Copy officer review prompt
2. Copy player-friendly feedback prompt
3. Copy structured JSON

Each export should include:

- encounter/fight context
- player identity and class/spec if available (spec currently unknown unless present)
- assignment context (`Unknown`)
- deaths/survivability evidence
- opener/casts/activity evidence
- cooldown/consumable/defensive evidence where available
- utility evidence where available
- top findings
- limitations/uncertainty
- explicit instruction to avoid blame and prioritize 2–3 improvements

Guardrails for prompts:

- use only provided evidence
- separate evidence from interpretation
- mention uncertainty
- avoid inventing boss/spec rules, assignments, or blame

## UI placement and clipboard behavior

- Add **AI Review Export** card to Player Fight Review page (after header is preferred).
- Buttons:
  - Copy officer review prompt
  - Copy player-friendly feedback prompt
  - Copy structured JSON
- Copy approach:
  - `navigator.clipboard.writeText(...)`
  - local copied state for success confirmation
  - inline error state if copy fails

## Optional fight-level export

- Optional only if small/natural after player-level is complete.
- Must not delay core player export slice.

## Verification plan

Run and report:

```bash
npm run typecheck
npm run lint
npm run build
git diff --check
```

Note: no current test script/framework in `package.json`; keep helper functions pure for future tests.

## Explicit out-of-scope list

- direct OpenAI/LLM API calls
- storing LLM API keys
- saving AI responses
- Discord bot integration
- SQLite persistence
- player profiles/trends
- raid readiness scoring
- similar-log benchmarking
- spec-specific rotation judgment
- boss-specific mechanic judgment

## Risks/pitfalls

1. Prompt bloat from too many events → cap arrays + summarize.
2. Hallucinated AI advice → include strict guardrails + limitations.
3. Blame language drift → instruct constructive/non-shaming outputs.
4. Unknown assignment context → keep explicit caveats.
5. Clipboard failures → show inline fallback/error message.
6. Missing spec data → mark unknown, do not infer.

## Readiness

This PR04 slice is ready for implementation after approval.

Recommended execution order:

1. Implement pure prompt builders
2. Add export card + copy UX
3. Wire into player review page
4. Optionally add fight-level export if still small
5. Update docs/backlog
6. Run verification commands
