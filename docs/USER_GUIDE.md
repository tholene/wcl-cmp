# Player Analysis Export User Guide

## Purpose

Player Analysis Export builds an evidence bundle from Warcraft Logs for one raider, with optional benchmark comparison, so officers can review performance consistently in ChatGPT.

## Step-by-step flow

1. Open `/player-analysis`.
2. Enter player name — the app searches raid boss kills from the last 30 days automatically.
3. Select a boss kill from the list (grouped by encounter and difficulty).
4. Optional: configure benchmark mode and candidate selection.
5. Click generate export.
6. Download `bundle.zip`.
7. Upload ZIP to ChatGPT and follow `README.md`.

The default scope is last 30 days, raid-only, kills only. Dungeons and wipes are excluded by default. Use the Advanced sidebar to change the scope or switch to manual report selection.

## ZIP contents

Expected core files:

- `README.md`
- `manifest.json`
- `bundle.zip` (download artifact)
- `player-fights.csv`
- `player-combatant-info.csv` (when selected)
- selected `player-*.csv` event views

When benchmark is included:

- `benchmark-*.csv`
- `comparison-summary.csv`
- `benchmark-candidates.json` or `benchmark-candidate.json`

## ChatGPT usage

Use this exact next step after export:

`Upload this ZIP to ChatGPT. The README contains the analysis instructions.`

The README defines required output sections and caveats for fair, evidence-based coaching.

## Status meanings

- `complete`: export passed quality gate checks and is ready for ChatGPT.
- `partial`: ZIP is usable, but one or more non-critical checks/warnings failed (for example benchmark omission or skipped views).
- `failed`: critical export artifacts/usability failed (for example missing ZIP, missing README/manifest, or unusable subject data).

## Troubleshooting

- Player not found or no fights included:
  Verify player name, include player-present fights, and re-run preview.
- No recent boss kills found (last 30 days):
  The boss list scans raid reports from the last 30 days. If no raid reports are found, the preview warning will say so. Use `Advanced → Timeframe → Manual report selection` to enter specific report codes.
- Latest raid session heuristic:
  The `Latest raid session` option (Advanced sidebar) uses the most recent raid session in the last N guild reports. This can miss older raids if the guild has been doing M+ dungeons recently. Prefer `Last 30 days` (default).
- Item level looks wrong:
  Item level is taken from the CombatantInfo snapshot in the specific fight log — it reflects gear at the time of that kill, not current armory data. If the fight is from an older kill, item level will be lower.
- Benchmark requested but missing:
  Select an exportable candidate or enable the subject-only override.
- Partial export with skipped/truncated data:
  Reduce fights/views and retry for a narrower bundle.
- Failed export:
  Check the failed step + recovery suggestion in UI, then retry with smaller scope.
- Missing or stale WCL data:
  Re-run later and confirm credentials in `.env`.
