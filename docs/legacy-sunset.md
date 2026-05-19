# Legacy Route/Endpoint Sunset Notes

WP0 established **Player Analysis Export** as the only primary workflow.

These legacy routes/endpoints remain callable for deep links and compatibility only.

## Remaining legacy frontend routes (non-primary)

- `/bosses`
- `/bosses/:encounterId`
- `/reports/:code`
- `/reports/:code/fights/:fightId`
- `/reports/:code/fights/:fightId/players/:playerId`

## Remaining legacy backend endpoints (non-primary)

- `GET /api/reports/recent`
- `GET /api/reports/:code`
- `GET /api/reports/:code/fights/:fightId/review`
- `GET /api/reports/:code/fights/:fightId/players/:playerId/review`
- `GET /api/bosses/recent`
- `GET /api/bosses/:encounterId/recent-fights`
- `POST /api/player-reviews/snapshot`
- `POST /api/player-reviews/scope-preview`
- `POST /api/player-reviews/prompt`

## Sunset intent

- These interfaces are deprecated from primary product flow.
- No new feature work should target legacy routes/endpoints.
- New export and benchmark work must target `/api/player-analysis/*`.
- Legacy interfaces will be removed after a confidence window once no active local workflows depend on them.
