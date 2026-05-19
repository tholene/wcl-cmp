# Player Analysis Export Backlog

## Product Goal

Build a single-purpose Warcraft Logs Player Analysis Export tool that lets officers:

1. Select player + scope.
2. Select fights.
3. Optionally include benchmark comparison.
4. Export analysis-grade ZIP evidence for ChatGPT/manual review.

## Product Rules

- Auto benchmark discovery is default; manual is fallback.
- If benchmark is requested and no exportable benchmark exists, block by default.
- Subject-only export is allowed only via explicit override.
- Unknown class/spec/role stays unknown unless WCL detects it or user provides it.
- Do not return raw high-volume event payloads through API responses.
- WCL credentials stay server-side.

## Completed slices (as of 2026-05-19)

- Player Analysis Export is primary route and primary nav.
- 4-step workflow (player, raid/boss, benchmark, export).
- Latest-raid scope defaults to raid-only logs.
- One-boss default selection with explicit multi-fight opt-in.
- Explicit benchmark candidate selection wired to export payload.
- Subject vs benchmark item-level source separation + mismatch warning.
- README AI instruction block and output structure.

## Work Packages

### WP0 — Product focus cleanup

Status: Done

### WP1 — Player search, scope preview, explicit fight selection

Status: Done

### WP2 — Analysis-grade export data

Status: Done

### WP3 — Manual class/spec override when WCL detection fails

Status: Done

### WP4 — Benchmark comparison export wiring

Status: Done

### WP5 — Automated benchmark discovery baseline

Status: Done

### WP6 — Runtime error hardening + smoke coverage

Status: In progress

### WP7 — MVP hardening: export quality gate + ChatGPT-ready result contract

Status: Done

Scope completed:

- Added post-export quality gate evaluation in backend finalization.
- Added result summary contract (quality checks + top reasons + ChatGPT-ready fields) on job status payload.
- Enforced terminal status policy:
  - `partial` when ZIP is usable but checks/warnings fail.
  - `failed` for critical artifact/usability failures.
- Hardened final export results panel around Ready-for-ChatGPT summary, partial reasons, failed-step recovery.
- Added user guide and MVP smoke checklist docs.
- Updated legacy sunset notes and removed deprecated prompt-first UI surface from legacy player review page.

## Follow-ups

- Investigate ranking item-level vs CombatantInfo item-level source mismatches.
- Maintain and periodically validate raid-zone classification config in [raid-zone-classifier.ts](/home/tholene/Projects/git/std-analyzer/server/warcraft-logs/raid-zone-classifier.ts) (`raidZoneIds`, `raidZoneNames`, `raidZoneAliases`).
- Add optional automated smoke tests for MVP flow.
- Visual polish pass (status icons/spec imagery/visual hierarchy only).
- Remove remaining legacy routes/endpoints after confidence window.
