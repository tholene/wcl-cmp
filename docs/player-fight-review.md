# Player Fight Review (PR03)

## Purpose

Player Fight Review adds a player-level drilldown that helps officers and raiders answer:

- What happened for this specific player on this pull?
- What evidence is available?
- What remains uncertain or partial?

The feature is evidence-first and intentionally avoids blame language, spec-rotation correctness claims, or readiness scoring.

## Route

- Frontend route: `/reports/:code/fights/:fightId/players/:playerId`

## Backend endpoint

- `GET /api/reports/:code/fights/:fightId/players/:playerId/review`

### Error handling

- Invalid `fightId` or `playerId` returns `400` JSON.
- Missing report/fight/player returns `404` JSON where distinguishable.
- Upstream Warcraft Logs failures return safe `502` JSON.
- Other failures return safe `500` JSON.

Responses do not expose OAuth tokens, WCL credentials, or raw secret values.

## Data shown on the page

1. **Overview**
   - player, encounter, result, duration, and navigation links
2. **Assignment context placeholder**
   - explicit `Unknown` context with interpretation caveat
3. **Top findings**
   - deterministic, cautious findings with confidence + limitations
4. **Evidence categories**
   - Context
   - Output
   - Execution
   - Survivability
   - Utility / assignments
   - Consistency / trend placeholder
   - Confidence / limitations
5. **Deaths / survivability**
6. **Opener timeline (first 45s)**
7. **Casts / activity summary**
8. **Cooldowns / consumables / defensives where detectable**
9. **Utility events where detectable**

## Evidence language guidance

PR03 uses cautious wording such as:

- "No recognized consumable event detected from available events"
- "No opener casts detected from available events"
- "Data may be partial"

This avoids overclaiming and preserves officer context review.

## Structured evidence foundation

PR03 introduces a structured player-review payload that is designed to be reused by:

- §4 Structured AI Review Export
- §11 Player Success Matrix and Evidence Packs

PR03 does **not** implement scoring, readiness ranking, or final success-matrix decisions.

## Known limitations

- Event pagination may leave categories partial on some pulls.
- Assignment context remains `Unknown` in PR03.
- Utility/consumable/defensive detection is generic and based on recognizable event names.
- Interrupt/dispels are surfaced only where detectable from available events.
- Cross-pull consistency/trend remains placeholder-only in this PR.

## Out of scope in PR03

- Direct LLM/OpenAI integration
- Prompt export implementation
- SQLite persistence
- Player profile/history/trend storage
- Raid readiness scoring
- Spec-specific rotation correctness
- Boss-specific mechanic judgment

## DB migration status

No DB migration. Data is fetched from WCL through the backend and returned at request time.