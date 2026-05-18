# Benchmark Discovery Notes (WP5)

Last verified: 2026-05-18

## Live query text used

```graphql
query EncounterCharacterRankings(
  $encounterId: Int!
  $className: String!
  $specName: String!
  $metric: CharacterRankingMetricType!
  $difficulty: Int!
) {
  worldData {
    encounter(id: $encounterId) {
      characterRankings(
        className: $className
        specName: $specName
        metric: $metric
        difficulty: $difficulty
        page: 1
      )
    }
  }
}
```

## Example variables used (no secrets)

```json
{
  "encounterId": 3306,
  "className": "Shaman",
  "specName": "Enhancement",
  "metric": "dps",
  "difficulty": 5
}
```

## Live scalar shape observed

- `characterRankings` arrived as an `object` scalar (not a JSON string) in the sampled run.
- Top-level keys observed:
  - `count`
  - `hasMorePages`
  - `page`
  - `rankings`
- First ranking entry keys observed:
  - `amount`, `bracketData`, `class`, `duration`, `faction`, `guild`, `hardModeLevel`, `name`, `report`, `server`, `spec`, `startTime`
- `report` object keys observed:
  - `code`
  - `fightID` (capital `D`)
  - `startTime`

## Field presence from smoke run

- Report code: present at `entry.report.code`
- Fight ID: present at `entry.report.fightID` (capital `D` variant confirmed)
- Player name: present at `entry.name`
- Class/spec: present at `entry.class` and `entry.spec` (short-key variant confirmed)
- Percentile: not present in sampled entries; derived from `rank` + `count`
- Item level: `entry.itemLevel` not present in sampled entry; `entry.bracketData` present and used as fallback
- Duration: present at `entry.duration` (milliseconds in sampled rows)
- Server/region: present as object at `entry.server` with `{ id, name, region }`
- `serverSlug`/`serverRegion`: not present in sampled entry; code keeps defensive fallbacks

## Hidden/anonymous name behavior

- In sampled ranking page (`count=100`), hidden-name matches were `0`.
- WP5 logic still treats these values as non-exportable:
  - empty/blank names
  - `anonymous`, `hidden`, `private`, `redacted`, `unknown`, `unavailable`
  - patterns like `Player (N)`
- Such entries are never selected as `selectedCandidate` because `hasUsablePlayerName=false` feeds `hasUsableExportTarget=false`.

## Exportability and fallback guidance

- Candidate is exportable only when all are true:
  - same encounter/difficulty/class/spec validation
  - usable player name
  - report code present
  - fight ID present
- Baseline rows missing required fields are skipped before any WCL query and emit per-field warnings for:
  - `reportCode`, `fightId`, `encounterId`, `encounterName`, `difficulty`, `playerName`, `className`, `specName`
- Auto mode UI guardrail:
  - if selected baselines return no exportable `selectedCandidate`, export is disabled and UI directs officer to Manual benchmark mode or context/baseline adjustments.

