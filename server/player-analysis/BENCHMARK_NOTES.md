# Benchmark Discovery — Phase A Spike Notes

## Status

**Phase A (API spike) is pending live verification.**

The automated benchmark candidate discovery feature is **not yet implemented**.
This file documents the planned investigation and what needs to be confirmed before proceeding.

---

## What we need to verify

To implement automated 50/75/90 percentile candidate selection, the WCL v2 GraphQL API must return:

1. `report.code` — so we can fetch the candidate's log
2. `report.fightID` — so we can fetch the specific fight
3. `class` and `spec` — so we can verify same-class/same-spec requirement
4. `itemLevel` or `bracketData` — so we can apply ilvl proximity scoring
5. `duration` — so we can apply kill-time proximity scoring
6. `amount` or `percentile` — so we can target a specific parse tier (50/75/90)

---

## Query to verify

```graphql
query EncounterRankingSpike($encounterId: Int!) {
  worldData {
    encounter(id: $encounterId) {
      characterRankings
    }
  }
}
```

The `characterRankings` field accepts:
- `className: String`
- `specName: String`
- `metric: CharacterRankingMetricType` (e.g., `dps`)
- `difficulty: Int`
- `partition: Int` (optional)
- `bracket: Int` (optional, for item level bracket)
- `page: Int` (optional)

It returns an opaque JSON scalar.

---

## Expected response shape (from WCL public docs — UNVERIFIED against current API)

```json
{
  "rankings": [
    {
      "name": "PlayerName",
      "class": "Warrior",
      "spec": "Arms",
      "amount": 123456.78,
      "duration": 180000,
      "startTime": 1234567890000,
      "report": {
        "code": "abc123XYZ",
        "fightID": 5,
        "startTime": 1234567890000
      },
      "guild": { "name": "GuildName", "id": 12345 },
      "itemLevel": 645,
      "bracketData": 645.5,
      "faction": 0,
      "medal": null,
      "score": 9876,
      "banned": false
    }
  ],
  "count": 50,
  "page": 1
}
```

---

## What to do during Phase A

1. Run the spike query with a known encounterId (e.g., from a recent guild report).
2. Log the actual response shape.
3. Verify:
   - Does `report.code` exist and is it usable?
   - Does `report.fightID` exist?
   - Are `class` and `spec` present and reliably populated?
   - Is `itemLevel` present?
   - Is `duration` in milliseconds?
   - Is there a `percentile` field, or must it be computed from rank/count?
4. Update this file with actual findings.
5. If all required fields are present, implement `findBenchmarkCandidates` in
   `player-analysis-benchmark.service.ts`.
6. If fields are missing or unreliable, document which ones and what alternatives exist.

---

## Current status

- [ ] Phase A query run against live WCL API
- [ ] Response shape documented
- [ ] Required fields verified or alternatives identified
- [ ] Phase B (automated candidate selection) unblocked or blocked with clear reason

Until Phase A is complete, the benchmark endpoint returns an empty stub with a warning.
Manual benchmark via `reportCode + fightId + playerName` is available as a fallback.
