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

## Current follow-up state

- Settings are now wired into request context with precedence:
  - request/settings value
  - else server ENV
  - else omitted (or explicit error where required)
- `defaultCharacter` was intentionally removed from settings to avoid conflicting with the player search input; player search remains the source of truth for the analyzed character.
- `defaultRealm` was removed from settings for the same reason; character identity remains owned by player search/selection flows.
- Guild ID can come from settings or `WCL_GUILD_ID`; guild-scoped routes now return a clear error when neither is available.
- WCL client credentials remain server-only environment variables (`WCL_CLIENT_ID`, `WCL_CLIENT_SECRET`).

## Compatibility probe status (2026-05-24)

Live probe run: **yes** (via `npm run spike:wcl-sites`)

Probe scope:
- Token acquisition through the existing WCL client path (implicitly exercised by GraphQL call).
- Minimal GraphQL query (`__typename`) per site.
- Guild-scoped recent reports query per site when `WCL_GUILD_ID` is available.

Probe outcomes:
- Retail: minimal GraphQL ✅, recent reports ✅
- Classic: minimal GraphQL ✅, recent reports ✅
- Fresh: minimal GraphQL ✅, recent reports ✅

What this **does not** prove:
- Full player-analysis parity for Classic/Fresh.
- Encounter rankings/benchmark query behavior across all Classic/Fresh content.
- Event/table shape parity for combatant info, casts, buffs, damage, deaths, etc.
- Export bundle quality parity across all views/fights.

## Probe command

Run:

```bash
npm run spike:wcl-sites
```

The script lives at:

`scripts/spikes/check-wcl-site-compatibility.ts`

Notes:
- Uses server-side env credentials only.
- Does not print secrets or access tokens.
- Not part of normal tests/build.

## Known risks (still open)

- Classic/Fresh schema differences can still break deeper player-analysis queries.
- `raid-zone-classifier` remains retail-oriented and may misclassify non-retail zones.
- Guild IDs may not map meaningfully across all selected sites.
- Character search/exact lookup is still future work and not solved by this probe.
