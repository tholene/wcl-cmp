# Player Lookup Modes: Guild vs Global

## 1) Current Guild mode (implemented)

### Data path today

- Frontend autocomplete calls `GET /api/players/recent`.
- Backend route requires guild-scoped context (`requireGuildIdForGuildScopedFlow`).
- `WclService.getRecentPlayers` is built from guild reports:
  1. `listRecentReports` uses `reportData.reports(guildID: ...)`.
  2. Each report is read via `reportData.report(code)` for fights.
  3. Player names are aggregated from `masterData.actors` (`type === "Player"`).
  4. Results are sorted by recent raid-kill presence.
- Player preview/export then follows the existing report flow:
  - reports -> report fights -> raid boss kills -> single selected boss kill -> benchmark -> export bundle.

### Dependency on `guildId`

- Required for:
  - `GET /api/reports/recent`
  - `GET /api/players/recent`
  - export preview/start when `reportCodes` are not explicitly provided (discovery path).
- Not required for app startup; only required when a guild-scoped discovery endpoint is used.

### Strengths

- Fast, practical autocomplete for officer workflows.
- High relevance to guild raids.
- Reuses existing report/fight/export pipeline with minimal ambiguity.

### Limitations

- Cannot discover players outside the configured guild.
- Character identity is inferred from recent guild report actor names only.
- Realm/name collision handling is limited (same normalized name can merge).
- Fresh/Classic/Retail parity is still best-effort beyond baseline probes.

## 2) Proposed Global mode (planned, not implemented)

### Requirement

- Must work without `guildId`.

### Desired UX

1. User picks WCL site (`retail`/`classic`/`fresh`).
2. User searches for a character (or pastes a character URL).
3. App resolves/selects one concrete character identity.
4. App lists recent boss kills for that character.
5. Benchmark and export screens stay visually the same.

## Global boss-kill discovery status (backend-only, implemented)

- Added endpoint: `POST /api/wcl/character/boss-kills`.
- Resolver remains the entry point:
  - `characterUrl` OR exact tuple (`site + region + realmSlug + characterName`).
- Discovery is guild-independent (no `guildId` requirement).
- Current discovery method:
  1. Resolve character identity.
  2. Fetch `character.recentReports`.
  3. Filter to raid-zone reports.
  4. Flatten boss fights (`reportCode + fightId + encounter + difficulty + kill + timing`).
  5. Enrich a capped subset with `report.rankings(fightIDs: [...])` for class/spec/item level/percentile where available.

What this enables now:
- Backend can return global recent raid boss-kill candidates compatible with future boss-card UI needs.

What is still not implemented:
- No frontend wiring to global mode.
- No fuzzy/search-as-you-type.
- No declaration that global mode is end-to-end complete.

## 3) Key technical questions to answer

1. Does WCL expose a true fuzzy/search-as-you-type character search API?
2. Does WCL expose exact character lookup by `site + region + realm + name`?
3. Can recent boss kills be fetched for one character without guild report discovery?
4. Do usable character endpoints include `reportCode`, `fightId`, `encounter`, `difficulty`, `duration`, `itemLevel`, `spec`?
5. Does behavior stay consistent across Retail, Classic, and Fresh?
6. What normalization/input model is needed for CJK and non-latin character names?

## 4) Candidate API strategies

### A) True global fuzzy search (if WCL supports it)

Pros:
- Best UX for discovery.
- Low user friction.

Cons:
- API support is currently unconfirmed.
- Might differ by site or by auth scope/rate limits.

### B) Exact resolver (`site + region + realm + name`)

Pros:
- Deterministic identity selection.
- Easier to validate and cache.

Cons:
- Higher user input burden.
- Requires strong realm normalization rules.

### C) Paste WCL character URL fallback

Pros:
- Low ambiguity when URL is valid.
- Works even if fuzzy search is unavailable.

Cons:
- Worse discoverability/ergonomics.
- Requires robust URL parsing/validation and site-host matching.

### D) Local/recent-player index cache

Pros:
- Very fast repeat lookups.
- Useful offline-ish convenience in a local-first tool.

Cons:
- Stale/incomplete for first-time or out-of-guild lookups.
- Needs invalidation and clear “cache freshness” UX.

### E) Hybrid strategy (recommended direction)

- Keep Guild mode autocomplete as-is.
- Add Global mode resolver path (exact and/or URL-first).
- Use local cache only as assistive acceleration.

Pros:
- Preserves current working flow.
- Adds non-guild capability incrementally with low risk.

Cons:
- Two lookup modes increase UX and backend branching complexity.

## 5) Proposed future settings/search model

### Settings

- `wclSite` (required to run requests; defaults effectively to retail when unset)
- `guildId` optional
- `region` optional

No character identity fields in Settings (`defaultCharacter` and `defaultRealm` stay removed).

### Player lookup mode (future UI/control)

- `auto` / `guild` / `global`

Proposed behavior:

- If `guildId` exists: default mode = Guild.
- If `guildId` is missing: default mode = Global.
- User can switch mode explicitly.
- Guild mode requires `guildId`.
- Global mode requires enough character identity to resolve globally.

## 6) Recommended future slices (ordered)

1. Introduce lookup mode model + UI copy only (`auto/guild/global`), no resolver changes yet.
2. Run a backend API spike for global character lookup capabilities on all three sites.
3. Implement a backend character resolver contract (exact resolver and URL resolver first).
4. Implement global-mode recent boss kill discovery from resolved character identity.
5. Add search UI mode toggle and wire mode-specific validation/errors.
6. Keep guild flow as a first-class fallback path at every stage.

## Probe status for this slice

- Added backend-only global character resolver foundation:
  - URL parser for whitelisted WCL hosts (`retail`/`classic`/`fresh`).
  - Exact lookup resolver using `characterData.character(name, serverSlug, serverRegion)`.
  - Isolated endpoint: `POST /api/wcl/character/resolve`.
  - Dev probe script: `npm run spike:wcl-character`.
- Live probe status (May 24, 2026):
  - Exact query shape is accepted by schema.
  - Retail probe resolved a known character (`Bagge` on `EU/the-maelstrom`).
  - Classic/Fresh accepted the query shape in probe path; sample identity returned `not_found`.
- Live boss-kill discovery probe status (May 24, 2026):
  - Retail: `character.recentReports.data[].fights` returned raid-boss candidates with report code + fight id.
  - Retail: per-fight `report.rankings(fightIDs:[...])` returned player class/spec/item-level/percentile enrichment for matched rows.
  - Classic/Fresh: deeper boss-kill path not yet fully verified with known characters in this slice.
- Still intentionally unimplemented:
  - No search-as-you-type/fuzzy global search.
  - No frontend global-mode wiring for recent boss-kill discovery.
