# Benchmark Discovery — API Notes

## Status

**Phase A (API spike) is integrated into the implementation.**

`findBenchmarkCandidates()` in `player-analysis-benchmark.service.ts` now runs the
`characterRankings` query against the live WCL v2 GraphQL API. The response shape is handled
defensively — unknown field names are tolerated and the function returns `apiSupported: false` if
the response does not match the expected shape.

The actual shape returned by WCL should be verified by running the app with auto benchmark enabled
and checking logs/warnings. Update the sections below after the first real run.

---

## GraphQL query used

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

### Variables used (example)

```json
{
  "encounterId": 2901,
  "className": "Warrior",
  "specName": "Arms",
  "metric": "dps",
  "difficulty": 5
}
```

Secrets omitted. WCL_CLIENT_ID and WCL_CLIENT_SECRET are loaded from environment.

---

## Response shape — from WCL public docs (UNVERIFIED against current API)

`characterRankings` is an opaque JSON scalar. Based on WCL public documentation, the expected shape is:

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
      "rank": 5,
      "report": {
        "code": "abc123XYZ",
        "fightID": 5,
        "startTime": 1234567890000
      },
      "guild": { "name": "GuildName", "id": 12345 },
      "itemLevel": 645,
      "bracketData": 645.5,
      "faction": 0,
      "banned": false
    }
  ],
  "count": 50,
  "page": 1
}
```

---

## Field verification checklist

Update this table after the first real run against the live API:

| Field | Expected path | Present | Notes |
|---|---|---|---|
| Report code | `rankings[n].report.code` | ❓ | Required for export |
| Fight ID | `rankings[n].report.fightID` | ❓ | Note capital D — also check `fightId` |
| Class | `rankings[n].class` | ❓ | Also check `className` |
| Spec | `rankings[n].spec` | ❓ | Also check `specName` |
| Item level | `rankings[n].itemLevel` | ❓ | Falls back to `bracketData` |
| Duration | `rankings[n].duration` | ❓ | Assumed milliseconds — verify |
| Rank | `rankings[n].rank` | ❓ | Used with `count` to derive percentile |
| Percentile | `rankings[n].percentile` | ❓ | May not exist — derived from rank/count |
| Amount | `rankings[n].amount` | ❓ | Raw metric value |
| Report start time | `rankings[n].report.startTime` | ❓ | Optional |
| Total count | parsed scalar `count` | ❓ | Used for percentile derivation |

---

## Implementation notes

### Opaque scalar handling

The `parseCharacterRankingsScalar()` function handles two cases:

1. The scalar is already a parsed JSON object (common in WCL v2)
2. The scalar is a JSON string that must be parsed (some WCL contexts return this)

If neither applies, the function returns `null` and `apiSupported: false` is returned.

### Field name defensive checks

The normalizer checks both short and long field variants:
- `entry['class']` and `entry['className']`
- `entry['spec']` and `entry['specName']`
- `report['fightID']` and `report['fightId']`

After the first real run, identify which variant is actually used and remove the dead branch.

### Percentile derivation

If the ranking entry does not include a `percentile` field, it is derived from:
```
percentile = round((1 - (rank - 1) / totalCount) * 100)
```

This assumes WCL returns 1-based rank (rank 1 = highest). Verify this assumption.

### Duration units

Duration is assumed to be in milliseconds based on WCL conventions. If the first run shows
durations in the range of seconds (e.g., 180 for a 3-minute kill), multiply by 1000 and update
the normalizer.

---

## Known API limitations

- `characterRankings` returns the top page of rankings for a given encounter/class/spec/metric.
  There is no filter for a specific percentile range — the app selects the best candidate
  from the returned list by scoring against the target percentile.
- The returned character name may differ from the in-game name for cross-realm or name-changed
  characters. Actor lookup by name in `getActorMap()` may fail in these cases — a warning is
  added and the candidate is skipped.
- Auto benchmark mode selects the best candidate from the first unique encounter+difficulty combo
  in the export scope. Multi-boss exports are not fully benchmarked in v1.
- Manual benchmark mode remains fully functional as a fallback regardless of API support.

---

## Phase checklist

- [x] Query written and integrated into `findBenchmarkCandidates()`
- [x] Opaque scalar safe-parse implemented
- [x] Normalizer handles both field name variants defensively
- [x] Scoring and candidate selection implemented
- [x] `apiSupported: false` returned on API failure or unexpected shape
- [x] Export service updated to use auto mode candidates
- [x] Frontend UI updated with mode toggle and candidate preview
- [ ] First real run against live WCL API completed
- [ ] Field names confirmed (class vs className, fightID vs fightId, etc.)
- [ ] Percentile field presence confirmed
- [ ] Duration unit (ms vs s) confirmed
- [ ] Dead code branches removed from normalizer after field name verification
