# Legacy Route/Endpoint Sunset Notes

WP0 establishes **Player Analysis Export** as the only primary workflow.

These routes/endpoints are kept callable for deep links and compatibility only.

## Legacy frontend routes (non-primary)

- `/bosses`
- `/bosses/:encounterId`
- `/reports/:code`
- `/reports/:code/fights/:fightId`
- `/reports/:code/fights/:fightId/players/:playerId`

## Legacy backend endpoints (non-primary)

- `POST /api/player-reviews/snapshot`
- `POST /api/player-reviews/scope-preview`
- `POST /api/player-reviews/prompt`

Sunset status:
- Deprecated from primary app flow in WP0.
- No new feature work should target these endpoints.
- New product work should use `/api/player-analysis/*`.
