# WCL Compare Product Roadmap

## Purpose

This roadmap defines the next product slices for expanding WCL Compare from a retail guild-coupled flow toward configurable Warcraft Logs site support (Retail / Classic / Fresh) and future character lookup decoupled from hardcoded guild assumptions.

The approach is incremental and evidence-led: each slice should ship safely without regressing the current retail export workflow.

## Guiding constraints

- Local-first application behavior remains unchanged.
- No OpenAI API integration is introduced by these slices.
- No WCL secrets or API credentials are stored in browser storage.
- Retail behavior remains the safe default until Classic/Fresh behavior is verified.

## Delivery slices (in order)

### 1) WCL site config spike

Status: Completed

Goal:
- Validate multi-site assumptions before product wiring.

Scope:
- Centralize WCL host configuration in one backend config surface.
- Define initial host targets:
  - Retail: `www.warcraftlogs.com`
  - Classic: `classic.warcraftlogs.com`
  - Fresh: `fresh.warcraftlogs.com`
- Verify OAuth/token flow assumptions per site host.
- Verify GraphQL endpoint assumptions per site host.

Non-goals:
- No UI changes in this slice.
- No frontend settings behavior in this slice.

Exit criteria:
- Host mapping and endpoint assumptions are documented.
- Known risks and unknowns are captured for implementation slices.

Notes:
- Site mapping is centralized in backend config helpers.
- A live probe was run on May 24, 2026 against `retail`, `classic`, and `fresh`.
- Probe verified token+minimal GraphQL+guild recent-reports query paths only; deeper player-analysis compatibility is still partial.

### 2) Persistent Settings Drawer

Status: Completed

Goal:
- Add a first-class, persistent Settings surface that prepares the app for multi-site and future non-guild-coupled workflows without breaking today’s retail flow.

Required settings:
- WCL site: `retail` / `classic` / `fresh`
- Optional guild ID
- Optional region
- Future-safe structure for additional settings

UX:
- Add a Settings button near the existing Advanced button.
- Use a drawer/sheet visually similar to the existing Advanced panel.
- If no WCL site exists on first load, show first-run copy exactly:
  - “Choose which Warcraft Logs site you want to use. You can change this later in Settings.”
- Allow changing the selected site later from Settings.
- Do not break the current retail guild flow.

Persistence:
- Persist non-secret settings in localStorage.
- Use a versioned key (example): `wcl-cmp.settings.v1`.
- Settings must persist across sessions.
- Must not store WCL secrets or API credentials in localStorage.

Non-goals:
- Do not implement full Classic/Fresh compatibility in this slice.
- Do not replace current player search in this slice.
- Do not store API secrets locally.

Exit criteria:
- Settings drawer exists and persists allowed values across reloads.
- First-run dialog appears only when site setting is missing.
- Existing retail guild flow remains functional.

### 3) Wire app settings into WCL requests

Status: Completed

Goal:
- Apply selected app settings to request flow while maintaining backward-compatible defaults.

Scope:
- Frontend sends selected site and relevant optional context (guild/region) where needed.
- Backend accepts site/config inputs through a safe validated configuration path.
- Current retail behavior remains default-compatible when explicit settings are absent.

Non-goals:
- No character-search redesign here.
- No broad UX rewrite here.

Exit criteria:
- Request path can run with selected settings and still works with retail-default behavior.
- Error handling remains clear when optional settings are omitted.

Notes:
- Frontend now sends `wclSite` and optional `guildId`/`region` in report/player and player-analysis requests.
- Backend precedence is `request/settings > ENV > omitted`.
- Missing `guildId` now returns a clear error only for guild-scoped flows that require it.
- `defaultCharacter` and `defaultRealm` were intentionally removed from settings to keep player search as the single source of truth for character identity.
- Classic/Fresh schema behavior remains unverified beyond request routing and fallback/error handling.
- Character search and resolver work remain future slices.

### 4) WCL character search spike

Status: Completed (backend-only resolver foundation)

Goal:
- Determine viable player discovery paths independent of hardcoded guild report coupling.

Scope delivered:
- Added resolver contract for global character identity resolution.
- Added strict WCL character URL parser (retail/classic/fresh host whitelist).
- Added exact lookup service with `characterData.character(name, serverSlug, serverRegion)`.
- Added isolated backend endpoint `POST /api/wcl/character/resolve`.
- Added non-test probe command `npm run spike:wcl-character`.
- Added unit tests with mocked lookup path (no live calls in tests).

Fallback path if fuzzy search is unavailable:
- Exact lookup
- WCL character URL paste
- Local/recent-player index

What is still not delivered in this slice:
- No search-as-you-type/fuzzy global search implementation.
- No global recent boss-kill discovery.
- No frontend global-mode wiring.

Exit criteria:
- Backend resolver and URL fallback contract are in place.
- Exact lookup viability is validated in live probe path.
- Remaining unknowns (fuzzy search and global fight discovery) are explicitly documented.

### 5) Character resolver and search UX

Status: In progress (backend foundation complete, frontend wiring pending)

Goal:
- Implement chosen character lookup/resolver flow while preserving export UX continuity.

Scope:
- Build character lookup and resolution based on spike decisions.
- Keep the current visual flow: player → boss → benchmark → export.
- Integrate resolver behavior with settings-selected site defaults and mode-specific character identity inputs.
- Backend global recent boss-kill discovery foundation is now implemented:
  - resolver-driven identity resolution
  - character recent report fight discovery
  - raid-only candidate filtering
  - per-fight ranking enrichment (class/spec/item-level/percentile when available)
  - isolated endpoint `POST /api/wcl/character/boss-kills`

Non-goals:
- No unrelated redesign of export internals.

Exit criteria:
- Officers can find/select characters through the chosen resolver/search approach.
- Existing export sequence and operator ergonomics remain intact.

Notes:
- Global resolver + boss-kill discovery are available backend-side but are not wired into production UI yet.
- Fuzzy/search-as-you-type remains a separate unresolved capability question.

## Decisions

- localStorage is preferred for non-secret preferences.
- WCL secrets must not be stored in localStorage.
- Settings drawer should be visually similar to Advanced.
- Retail remains the safe default until Classic/Fresh behavior is verified.

## Current compatibility truth

- Retail flow remains the only fully trusted production path.
- Classic/Fresh have passed baseline endpoint probing (minimal GraphQL + recent reports).
- Classic/Fresh are **not yet declared fully compatible** for the full player-analysis export workflow.
- Error messaging now explicitly calls out selected-site compatibility risk when query/schema failures occur.
