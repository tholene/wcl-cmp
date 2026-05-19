# Player Analysis Export User Guide

## Purpose

Player Analysis Export builds an evidence bundle from Warcraft Logs for one raider, with optional benchmark comparison, so officers can review performance consistently in ChatGPT.

## Step-by-step flow

1. Open `/player-analysis`.
2. Enter player name.
3. Choose scope (`Latest raid` or `Manual report selection`).
4. Click preview.
5. Choose fights (default is one eligible boss kill).
6. Optional: configure benchmark mode and candidate selection.
7. Click generate export.
8. Download `bundle.zip`.
9. Upload ZIP to ChatGPT and follow `README.md`.

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
- Latest raid misses expected raid logs:
  Latest-raid classification uses explicit zone ID/name/alias rules plus fallback hints in [raid-zone-classifier.ts](/home/tholene/Projects/git/std-analyzer/server/warcraft-logs/raid-zone-classifier.ts). If your guild uses a new shorthand zone label, add it under `raidZoneAliases` (and optionally `raidZoneIds` / `raidZoneNames`).
- Latest raid returns no raid reports:
  Preview warnings now include compact diagnostics (`recent zones seen`, `rejected non-raid zones`, `raid reports without player presence`) to show why reports were excluded.
- Benchmark requested but missing:
  Select an exportable candidate or enable the subject-only override.
- Partial export with skipped/truncated data:
  Reduce fights/views and retry for a narrower bundle.
- Failed export:
  Check the failed step + recovery suggestion in UI, then retry with smaller scope.
- Missing or stale WCL data:
  Re-run later and confirm credentials in `.env`.
