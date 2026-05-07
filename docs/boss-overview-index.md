# Boss Overview Index (PR01)

## Purpose

Add boss-first navigation on top of recent Warcraft Logs report data so officers can answer:

- Which bosses have we recently pulled?
- How many pulls, kills, and wipes per boss?
- When did we last pull each boss?
- Which difficulties have we seen?
- Can we drill into one boss and inspect recent pulls quickly?

This feature is intentionally limited to recent-report aggregation and navigation.

## Frontend routes

- `/bosses` — boss overview index grouped by encounter.
- `/bosses/:encounterId` — recent pulls for one boss across recent reports.

## Backend endpoints

- `GET /api/bosses/recent`
- `GET /api/bosses/:encounterId/recent-fights`

## Data source window

Boss data is aggregated from the same recent report window used by report listing (currently the latest 15 reports).

The API response includes a `source.note` field so the UI can clearly communicate:

- normal full aggregation window, or
- partial data when one or more report-detail fetches fail.

## Timestamp semantics

Fight timestamps are exposed as absolute timestamps for UI display using:

```txt
absoluteFightStart = report.startTime + fight.startTime
absoluteFightEnd = report.startTime + fight.endTime
```

This avoids ambiguity when WCL fight timestamps are report-relative.

## Known limitations

- Aggregation is limited to the current recent-report window.
- No long-term historical storage in PR01.
- No death-cause analysis in PR01.
- No player review/scoring in PR01.
- No AI review/export in PR01.
- No boss/spec-specific mechanic logic in PR01.

## Out of scope

Explicitly not included in PR01:

- Fight review page (`/reports/:code/fights/:fightId`)
- Player review page
- Death analysis and pre-death windows
- SQLite persistence
- Benchmarking against public logs
- Raid readiness scoring
- LLM integration

## DB migration status

No DB migration was added. Boss data is aggregated from recent WCL report metadata at request time.
