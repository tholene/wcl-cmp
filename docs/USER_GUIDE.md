# WCL Compare — User Guide

## Purpose

WCL Compare builds a structured evidence bundle from Warcraft Logs for one raider, with optional benchmark comparison, so officers can review performance consistently using an AI analysis tool of their choice (ChatGPT, Claude, etc.).

## Step-by-step flow

1. Open `/player-analysis`.
2. Enter a player name — the app searches raid boss kills from the last 30 days automatically.
3. Select a boss kill from the list (grouped by encounter and difficulty).
4. Optional: configure benchmark mode and candidate selection.
5. Click generate export.
6. Download `bundle.zip`.
7. Upload the ZIP to your AI analysis tool of choice and follow the included `README.md`.

The default scope is last 30 days, raid-only, kills only. Dungeons and wipes are excluded by default. Use the Advanced sidebar to change the scope or switch to manual report selection.

## ZIP contents

Expected core files:

- `README.md`
- `manifest.json`
- `player-fights.csv`
- `player-combatant-info.csv` (when selected)
- selected `player-*.csv` event views

When benchmark is included:

- `benchmark-*.csv`
- `comparison-summary.csv`
- `benchmark-candidates.json` or `benchmark-candidate.json`

## Export status meanings

- `complete` — export passed all quality gate checks and is ready for analysis.
- `partial` — ZIP is usable, but one or more non-critical checks failed (e.g. benchmark omission or skipped views).
- `failed` — a critical artifact is missing or unusable (e.g. missing ZIP, missing README/manifest, or unusable subject data).

## Troubleshooting

- **Player not found or no fights included:**
  Verify the player name, ensure player-present fights are included in scope, and re-run the preview.

- **No recent boss kills found:**
  The boss list scans raid reports from the last 30 days. If no reports are found, the preview warning will say so. Use `Advanced → Timeframe → Manual report selection` to enter specific report codes.

- **Latest raid session picks the wrong raid:**
  The `Latest raid session` option uses the most recent raid session in the last N guild reports. It can miss older raids if the guild has been doing M+ recently. Prefer `Last 30 days` (default).

- **Item level looks wrong:**
  Item level is taken from the CombatantInfo snapshot in the specific fight log — it reflects gear at the time of that kill, not current armory data.

- **Benchmark requested but missing:**
  Select an exportable candidate or enable the subject-only override.

- **Partial export with skipped/truncated data:**
  Reduce the number of fights or views selected and retry for a narrower bundle.

- **Failed export:**
  Check the failed step and recovery suggestion in the UI, then retry with a smaller scope.

- **Missing or stale WCL data:**
  Re-run later and confirm credentials are set correctly in `.env`.
