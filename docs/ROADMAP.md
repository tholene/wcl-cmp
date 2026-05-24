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

Status: Planned

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

### 2) Persistent Settings Drawer

Status: Planned

Goal:
- Add a first-class, persistent Settings surface that prepares the app for multi-site and future non-guild-coupled workflows without breaking today’s retail flow.

Required settings:
- WCL site: `retail` / `classic` / `fresh`
- Optional guild ID
- Optional region
- Optional default realm/server
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
- `defaultCharacter` was intentionally removed from settings to keep player search as the single source of truth.
- Classic/Fresh schema behavior remains unverified beyond request routing and fallback/error handling.
- Character search and resolver work remain future slices.

### 4) WCL character search spike

Status: Planned

Goal:
- Determine viable player discovery paths independent of hardcoded guild report coupling.

Scope:
- Determine whether search-as-you-type/fuzzy character search is available.
- Determine whether exact lookup by site/region/realm/name is available.
- Determine whether recent boss kills can be fetched without guild-report coupling.
- Produce implementation recommendation and fallback strategy.

Fallback path if fuzzy search is unavailable:
- Exact lookup
- WCL character URL paste
- Local/recent-player index

Non-goals:
- No production character resolver implementation in this slice.

Exit criteria:
- Search capability findings are documented.
- One primary resolver path plus fallback behavior is selected.

### 5) Character resolver and search UX

Status: Planned

Goal:
- Implement chosen character lookup/resolver flow while preserving export UX continuity.

Scope:
- Build character lookup and resolution based on spike decisions.
- Keep the current visual flow: player → boss → benchmark → export.
- Integrate resolver behavior with settings-selected site/region/realm defaults.

Non-goals:
- No unrelated redesign of export internals.

Exit criteria:
- Officers can find/select characters through the chosen resolver/search approach.
- Existing export sequence and operator ergonomics remain intact.

## Decisions

- localStorage is preferred for non-secret preferences.
- WCL secrets must not be stored in localStorage.
- Settings drawer should be visually similar to Advanced.
- Retail remains the safe default until Classic/Fresh behavior is verified.
