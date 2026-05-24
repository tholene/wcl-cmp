# WCL Site Configuration and Character Search Spike Notes

## Current state

The app is currently a single-purpose Player Analysis Export flow optimized for a retail guild workflow:

1. select player
2. select one boss kill
3. select benchmark
4. export ZIP

Before this spike, Warcraft Logs host assumptions were hardcoded to `www.warcraftlogs.com` in multiple backend locations.

## New centralized site mapping

`server/warcraft-logs/wcl-site.ts` now defines the site model and host mapping:

- `retail` → `www.warcraftlogs.com` (`Retail`)
- `classic` → `classic.warcraftlogs.com` (`Classic`)
- `fresh` → `fresh.warcraftlogs.com` (`Fresh`)

Helpers provided:

- `getWclSiteConfig(site?)`
- `getWclGraphQlUrl(site?)`
- `getWclTokenUrl(site?)`
- `buildWclReportUrl(site, reportCode)`
- `buildWclCharacterUrl(site, region, realmSlug, characterName)`
- `buildWclCharacterIdUrl(site, characterId)`

Default behavior:

- Missing/unknown site resolves to `retail`.

## Hardcoded retail assumptions found

Retail host assumptions were found in:

- `server/warcraft-logs/wcl-client.ts`
  - OAuth token URL constant
  - GraphQL URL constant
- `server/warcraft-logs/wcl-service.ts`
  - report URL mapping
- `server/player-analysis/player-analysis-benchmark.service.ts`
  - benchmark report URL builder
  - character URL builder
- `server/player-analysis/player-analysis-export.service.ts`
  - subject and benchmark report links embedded in export rows

## What was centralized in this slice

- OAuth and GraphQL endpoint URL construction in `wcl-client` now resolves via `wcl-site`.
- Report/character URL construction in backend services now uses `wcl-site` helpers.
- Site URL behavior is now unit-tested in `server/warcraft-logs/__tests__/wcl-site.test.ts`.

## Endpoint assumptions (this slice)

Assumed endpoint pattern per site host:

- OAuth token: `https://<host>/oauth/token`
- GraphQL client endpoint: `https://<host>/api/v2/client`

Notes:

- This slice centralizes endpoint construction; it does not guarantee Classic/Fresh schema parity yet.
- No live endpoint verification is required by tests.

## Intentionally not implemented yet

- No settings drawer/sheet UI.
- No site selection UX.
- No request-level site selection from frontend.
- No character search or resolver flow.
- No replacement of current guild-coupled player discovery.
- No benchmark scoring changes.
- No export ZIP structure changes.

## Risks and known gaps

- Classic/Fresh GraphQL schema/behavior differences are not verified by this slice.
- `raid-zone-classifier` remains retail-oriented.
- Character search remains unimplemented in this slice.

## Next recommended slices

1. Persistent Settings Drawer
2. Wire selected settings into WCL requests
3. Character search spike

