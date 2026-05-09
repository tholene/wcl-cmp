# Fight Review Snapshot (PR02)

## Purpose

Fight Review Snapshot adds a focused pull-level review workflow that answers:

- What happened in this pull?
- Who died?
- What killed them?
- Who should be reviewed first?

The goal is evidence-first review, not blame assignment.

## Route

- Frontend route: `/reports/:code/fights/:fightId`

## Backend endpoint

- `GET /api/reports/:code/fights/:fightId/review`

### Error handling

- Invalid `fightId` returns `400` JSON.
- Missing report/fight returns `404` JSON where distinguishable.
- Upstream Warcraft Logs failures return safe `502` JSON.
- Other failures return safe `500` JSON.

Responses are intentionally safe and do not include OAuth tokens, client secrets, or raw internal upstream payloads.

## Data shown on the page

1. **Pull Summary**
   - encounter, report title, difficulty, kill/wipe, duration
   - death count and first death if present
   - links back to report details and WCL

2. **Review Shortlist**
   - first death
   - players who died
   - players with repeated death evidence items
   - manual review recommendation when source data is partial

3. **Death Timeline**
   - relative death timestamp
   - player and class/type (if available)
   - final lethal damage event when available
   - contributing damage in previous ~10 seconds

4. **Participants**
   - participant list from available fight source data
   - clean empty state when participant data is unavailable

## Interpretation guidance

The UI uses cautious wording:

- **Final lethal damage**
- **Contributing damage in previous 10s**
- **Data may be partial**

Final/lethal damage is evidence, not guaranteed root cause or responsibility.

## Known limitations

- Event data can be partial depending on Warcraft Logs event pagination/windowing for the selected query.
- This implementation prefers stable partial responses over fragile multi-step event collection.
- Some fights may return incomplete participant metadata.
- Roles are not derived in PR02 and are shown as not available.

## Out of scope in PR02

- Player fight review routes/endpoints (PR03)
- AI prompt export/generation
- Local persistence / SQLite
- Review scoring or blame logic
- Boss/spec-specific mechanic judgment

## DB migration status

No DB migration. Fight review data is fetched from WCL through the backend and returned at request time.