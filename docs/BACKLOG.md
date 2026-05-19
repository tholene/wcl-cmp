# Player Analysis Export Backlog

## Product Goal

Build a single-purpose Warcraft Logs Player Analysis Export tool.

The user should be able to:

1. Search/select a player from the guild.
2. Get logs from their latest raid, or select a particular log/set of logs.
3. Select fights to extract data from.
4. Compare that data with similar better players through automated benchmark discovery.
5. Fall back to manual benchmark selection when WCL data is anonymous, incomplete, or non-exportable.
6. Export all relevant WCL data into a ZIP bundle for ChatGPT/manual analysis.

This app is not primarily:
- a report browser
- a boss browser
- a prompt generator
- an AI verdict tool

The app is an export workbench for analysis-grade WCL data.

## Product Rules

- Auto benchmark discovery is the baseline happy path.
- Manual benchmark selection is fallback/override, not the primary intended workflow.
- If benchmark was requested but no exportable benchmark exists, block export by default.
- Only allow subject-only export through explicit override:
  "Export subject-only data without benchmark comparison."
- If override is used:
  - README.md must say benchmark was requested but not included.
  - manifest.json must include benchmarkRequested: true and benchmarkIncluded: false.
  - UI must show the exact reason benchmark was not included.
  - ZIP filename/summary must not imply benchmark data is included.
- Unknown class/spec/role means unknown unless WCL detects it or the user explicitly provides it.
- User-provided class/spec must be labelled user-provided everywhere.
- Do not return raw WCL event data through JSON API responses.
- Large data must be written to files and downloaded as files.
- WCL credentials stay server-side.
- Use the official WCL API only. Do not scrape WCL pages.

## Slice Completion Note (2026-05-19)

Completed focused usability/correctness slice for player-analysis export:
- Guided 4-step workflow (player, raid/boss, benchmark, export).
- `latestRaid` now defaults to raid-only logs (non-raid logs excluded by conservative classification).
- One-boss default selection after preview (prefer kill), with multi-fight as explicit opt-in.
- Explicit benchmark candidate selection wired from UI to export payload (no implicit backend-only selection).
- Benchmark candidate rows now show parse/rank/metric amount, ranking ilvl, duration, and deltas vs baseline.
- Item-level correctness split:
  - subject item level from subject CombatantInfo
  - benchmark ranking item level vs benchmark CombatantInfo item level
  - mismatch warning when absolute delta > 3
- README export header rewritten with explicit AI instructions, English-output requirement, and fixed output structure.

## Work Packages

### WP0 — Stabilize product shape and remove confusion

Status: Todo  
Priority: P0

Goal:
Make the app clearly about Player Analysis Export only.

Acceptance criteria:
- App home opens directly to Player Analysis Export.
- First visible primary control is player search/autocomplete.
- Report dashboard/boss/report detail pages are hidden, removed from nav, or clearly secondary.
- Old Player Reviews/prompt-first UI is gone.
- Deprecated routes/endpoints are documented with a sunset note.
- No UI implies that the app judges players directly.
- No duplicate competing workflows.

Notes/risks:
- Preserve deep links while removing primary-flow ambiguity.

### WP1 — Reliable player search, scope preview, and explicit fight selection

Status: Todo  
Priority: P0

Goal:
User can search guild players, select logs/timeframe, and choose fights.

Acceptance criteria:
- Player search/autocomplete from recent guild logs.
- Manual name entry still works.
- Latest raid default.
- Manual log/report selection.
- Multi-log selection.
- Explicit fight selection UI.
- Only-player-present filtering.
- Preview shows:
  - reports scanned/included
  - fights scanned/included
  - player presence
  - detected class/spec if available
  - warnings/diagnostics
- Preview response does not contain raw event data.
- Scope state stays consistent between preview and export:
  - reportCodes
  - fightIdsByReport
  - includeKills/includeWipes/includeTrash
  - onlyPlayerPresent

### WP3 — Manual class/spec override when WCL detection fails

Status: Todo  
Priority: P0

Goal:
Benchmark/search/export must not be blocked when WCL spec detection fails.

Acceptance criteria:
- Detect class/spec from CombatantInfo specID where possible.
- Do not infer spec from class alone.
- If spec/class is unknown, show clear diagnostics.
- User can manually select class/spec.
- Manual context is marked user-provided in UI, README, and manifest.
- If WCL-detected context conflicts with user-provided context, warn clearly.
- Benchmark can use user-provided class/spec when WCL detection fails.

Notes/risks:
- Unknown stays unknown unless explicitly user-provided.
- This must happen before reliable automated benchmark testing.

### WP2 — Analysis-grade export data

Status: Todo  
Priority: P0  
Hard blocker: Yes

Goal:
Export useful WCL data as CSV/JSON/README/ZIP.

Acceptance criteria:
- Export data to files under exports/player-analysis/<exportId>/.
- POST /export returns only lightweight job metadata.
- Status endpoint returns only progress/file metadata.
- Large data is downloaded via files.
- No 413 regressions.
- ZIP includes:
  - README.md
  - manifest.json
  - player-fights.csv
  - player-combatant-info.csv
  - player-damage-done.csv
  - player-damage-taken.csv
  - player-casts.csv
  - player-buffs.csv
  - player-deaths.csv
  - player-healing.csv
  - optional debuffs/resources/interrupts/dispels where WCL supports them
- All event CSVs include useful enriched columns:
  - timestamp
  - fightRelativeMs
  - sourceId/sourceName/sourceType/sourceSubType/sourceOwnerName
  - targetId/targetName/targetType/targetSubType/targetOwnerName
  - abilityGameId/abilityId/abilityName/abilityType
  - eventType
  - amount/overheal/absorbed/mitigated/critical where applicable
  - rawEventJson where useful
- Ability names must be resolved where WCL provides enough data.
- README/manifest include data quality stats.
- A real export must not show 0% abilityName across damageDone, casts, buffs, healing, and deaths unless README/notes include proof that WCL lacked names and no masterData mapping path existed.

Notes/risks:
- This is a hard blocker before benchmark comparison quality validation.

### WP5 — Automated benchmark discovery baseline

Status: Todo  
Priority: P0

Goal:
Find candidates similar to WCL compare/ranking behavior.

Acceptance criteria:
- Auto discovery is the default benchmark path.
- Search is baseline-fight-driven.
- User selects specific baseline fights after preview.
- For each baseline fight, use:
  - encounterId
  - difficulty
  - class
  - spec
  - duration
  - item level if available
  - target percentile 50/75/90
  - metric
- Do not search globally without an encounter.
- Do not benchmark different bosses/difficulties/specs.
- Candidate is valid only if same encounter/difficulty/class/spec.
- Prefer similar item level and kill time.
- Candidate must include reportCode/fightId/playerName to be exportable.
- Anonymous/non-exportable candidates are not auto-selected.
- If WCL API cannot provide enough data, document limitation and offer manual benchmark fallback.
- BENCHMARK_NOTES.md documents actual WCL API response shape with verified real response examples.

### WP4 — Benchmark comparison that actually exports data

Status: Todo  
Priority: P0

Goal:
When benchmark is selected, benchmark data appears in the ZIP.

Acceptance criteria:
- Benchmark comparison is optional but default workflow expects it.
- If benchmark is enabled, export request includes benchmark config.
- If selected benchmark candidates exist, export request includes them.
- Backend validates benchmark config.
- README/manifest say benchmark enabled yes/no accurately.
- If benchmark was requested but skipped, README/manifest/UI say why.
- Selected usable benchmark candidate produces:
  - benchmark-fights.csv
  - benchmark-combatant-info.csv
  - benchmark-damage-done.csv
  - benchmark-damage-taken.csv
  - benchmark-casts.csv
  - benchmark-buffs.csv
  - benchmark-deaths.csv
  - benchmark-healing.csv
  - benchmark-candidates.json
  - comparison-summary.csv
- Benchmark CSVs include columns linking benchmark rows to:
  - baseline fight
  - subject player
  - benchmark player
- Anonymous/unusable candidates are never treated as exportable.
- Manual benchmark fallback works:
  - report code
  - fight ID
  - player name

### WP6 — Robust runtime error handling and smoke tests

Status: Todo  
Priority: P0  
Mode: Continuous

Goal:
The app should fail clearly, not crash.

Acceptance criteria:
- All /api/player-analysis/* endpoints return structured JSON errors.
- Frontend handles empty/non-JSON responses safely.
- No “Unexpected end of JSON input”.
- No React render crashes from undefined .map.
- Benchmark form handles empty/missing arrays safely.
- Job errors appear through status endpoint.
- UI shows failed step and server error.
- Smoke test checklist is documented and repeatable.

## Implementation Order

1. WP0 — Product focus cleanup.
2. WP1 — Player search, scope preview, explicit fight selection.
3. WP3 — Manual class/spec override when WCL detection fails.
4. WP2 — Analysis-grade export data. Hard blocker.
5. WP5 — Automated benchmark discovery baseline.
6. WP4 — Benchmark data actually included in ZIP.
7. WP6 — Continuous hardening and smoke tests throughout.

## Critical Acceptance Tests

- Export for a real player produces non-empty CSVs.
- abilityName is populated where WCL provides enough data.
- README data quality does not show 0% abilityName across all views unless documented with proof.
- Manual class/spec override enables benchmark search when WCL detection fails.
- Auto benchmark success includes benchmark files and accurate manifest flags.
- Non-exportable auto candidate blocks export unless subject-only override is explicitly enabled.
- Override path emits subject-only bundle with explicit benchmark omission metadata.
- Manual fallback produces benchmark-inclusive export when valid.
- POST /export response is small.
- Status polling works.
- Downloaded bundle.zip contains expected files.
- npm run typecheck passes.
- npm run lint passes.
- npm run build passes.
