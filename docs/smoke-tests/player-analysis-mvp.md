# Player Analysis MVP Smoke Checklist

## Preconditions

- Install deps.
- Start frontend and backend:

```bash
npm run dev
npm run server:dev
```

- Use `/player-analysis`.

## MVP Checklist

- [ ] Search/select a raider (for example `Bagge`).
- [ ] Keep latest-raid scope or select manual reports.
- [ ] Preview export and confirm at least one player-present boss fight appears.
- [ ] Keep one selected fight (or choose specific fights).
- [ ] In auto benchmark mode, find/select benchmark candidate (or use manual benchmark fallback).
- [ ] Generate export.
- [ ] Confirm completion status card shows Ready-for-ChatGPT summary fields:
  - player
  - boss
  - difficulty
  - benchmark player/percentile/metric when available
- [ ] Confirm ZIP download CTA exists when files are produced.
- [ ] Confirm next-step copy shows exactly:
  - `Upload this ZIP to ChatGPT. The README contains the analysis instructions.`
- [ ] Confirm `README.md`, `manifest.json`, and `bundle.zip` are downloadable.
- [ ] Confirm benchmark files are present when benchmark included.
- [ ] Confirm partial mode shows headline `Export completed with partial data` and top reasons.
- [ ] Confirm failed mode shows failed step and recovery suggestion.

## Acceptance Mapping

- [ ] `/player-analysis` route renders.
- [ ] Officer can select player and reports.
- [ ] Snapshot-grade export includes fight context + damage/death evidence views.
- [ ] ChatGPT-ready ZIP workflow is copy/paste ready.
- [ ] Partial data is reported with warnings instead of crashing.
- [ ] Secrets remain server-side.
- [ ] No OpenAI API calls added.

## Pass/Fail Log

| Date | Tester | Environment | Result | Notes |
|---|---|---|---|---|
| 2026-05-19 | codex | local WCL-enabled run | pass | Player `Bagge`; report `ACDqPQncZ4vzTGr9`; latest player-present boss kill `Fallen-King Salhadaar` (Mythic); benchmark `Aknine` selected and exported; status `complete` with Ready-for-ChatGPT summary; README AI Instructions present; manifest contains `qualityGate` + `resultSummary`; benchmark files and valid `bundle.zip` confirmed. |
| 2026-05-19 | codex | local WCL-enabled run | pass | WP8 check: Latest raid classification now includes `VS / DR / MQD` logs. Verified with player `Heathin` (`latestRaid`: reportsIncluded=2, fightsIncluded=30, killsIncluded=8; includes report `B76K9dZNRWmzjrn4` titled `VS / DR / MQD`). Manual report scope still works (`reportCodes=[ACDqPQncZ4vzTGr9]`). |

## Latest run notes (2026-05-19)

- Historical WP7 run used manual report scope because `latestRaid` then excluded zone label `VS / DR / MQD`.
- Export ID: `19eb4f1b-40d6-47b2-a3e8-54349459270f`
- Bundle integrity check: `unzip -t` passed for all exported files.

## WP8 note (2026-05-19)

- `latestRaid` raid classification is now alias-aware and includes `VS / DR / MQD`.
- If latest raid is still empty for a specific player, preview warnings include compact diagnostics (`recent zones seen`, rejected zones and reasons, and raid reports where player presence was not found).
