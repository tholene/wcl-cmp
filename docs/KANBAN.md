# Kanban

## Backlog

### Card 2 — WCL site config spike
- title: WCL site config spike
- goal: Prepare for Retail / Classic / Fresh support by centralizing WCL host/config logic.
- scope:
  - Spike/design-first.
  - Do not change UI yet unless minimal.
  - Do not break current Retail behavior.
- non-goals:
  - No full multi-site product flow implementation.
  - No benchmark scoring/validation changes.
  - No export ZIP structure changes.
- likely files:
  - `server/warcraft-logs/wcl-client.ts`
  - `server/warcraft-logs/wcl-config.ts`
  - `server/warcraft-logs/wcl-site.ts` (new)
  - `docs/wcl-site-and-character-search.md`
- acceptance criteria:
  - Document current hardcoded `www.warcraftlogs.com` usage.
  - Propose or add centralized site config:
    - `retail` -> `www.warcraftlogs.com`
    - `classic` -> `classic.warcraftlogs.com`
    - `fresh` -> `fresh.warcraftlogs.com`
  - Verify or document OAuth/token and GraphQL endpoint assumptions.
  - No current Retail behavior regression.
- verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm test`
- planned commit message: `docs(wcl): spike site config support`

### Card 3 — WCL character search spike
- title: WCL character search spike
- goal: Determine if WCL supports search-as-you-type or fuzzy character search so the app can decouple from hardcoded guild autocomplete.
- scope:
  - API spike first.
  - Do not build full UI.
  - Preserve current guild-based autocomplete.
- non-goals:
  - No production UI migration.
  - No replacement of current player selection flow.
  - No benchmark/export behavior changes.
- likely files:
  - `docs/wcl-site-and-character-search.md`
  - `scripts/spikes/*` (new)
  - `server/warcraft-logs/*` only for minimal safe helpers if useful
- acceptance criteria:
  - Findings clearly document:
    - whether fuzzy/search-as-you-type exists
    - whether exact lookup by site/region/realm/name works
    - whether recent boss kills can be fetched without guild report coupling
    - whether behavior differs across Retail/Classic/Fresh
  - If fuzzy search is unavailable, recommend fallback:
    - exact lookup
    - WCL character URL paste
    - local/recent-player index
  - No product behavior changed.
- verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm test`
- planned commit message: `docs(wcl): spike character search support`

### Card 4 — Orphaned WCL type cleanup
- title: Orphaned WCL type cleanup
- goal: Prune dead WCL types left after backend legacy endpoint cleanup.
- scope:
  - Type cleanup only.
  - No behavior changes.
- non-goals:
  - No API behavior or response shape changes.
  - No frontend player-analysis flow changes.
  - No benchmark/export logic changes.
- likely files:
  - `server/warcraft-logs/wcl-types.ts`
  - `server/warcraft-logs/wcl-service.ts`
- acceptance criteria:
  - Remove only unused types confirmed via grep/typecheck.
  - Keep active player-analysis-related types intact.
  - `typecheck`, `lint`, `build`, and `test` pass.
- verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm test`
- planned commit message: `refactor(wcl): prune unused legacy types`

### Card 5 — Export/job tests
- title: Export/job tests
- goal: Add minimal tests around export job lifecycle and config validation.
- scope:
  - Test-only, unless tiny testability exports are required.
  - No behavior changes.
- non-goals:
  - No live WCL API calls.
  - No export pipeline redesign.
  - No benchmark scoring/validation changes.
- likely files:
  - `server/player-analysis/player-analysis-job-store.ts`
  - `server/warcraft-logs/wcl-config.ts`
  - `server/**/__tests__/*` (new)
- acceptance criteria:
  - Add stable tests for:
    - JobStore `create -> running -> complete/partial/failed`
    - WCL config validation success/failure cases
    - pure export validation helpers if available
  - Tests run without network access.
  - `npm test` passes.
- verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm test`
- planned commit message: `test(player-analysis): cover export job lifecycle`

## Ready

- none

## In Progress

### Card 1 — Benchmark form prop grouping
- title: Benchmark form prop grouping
- goal: Reduce `PlayerAnalysisBenchmarkForm` prop overload by grouping related props into cohesive typed objects.
- scope:
  - Refactor only.
  - No behavior changes.
  - No UI redesign.
  - No export/benchmark logic changes.
- non-goals:
  - No benchmark discovery algorithm changes.
  - No export ZIP or backend behavior changes.
  - No new product flow.
- likely files:
  - `src/features/player-analysis/components/player-analysis-benchmark-form.tsx`
  - `src/features/player-analysis/containers/player-analysis-page.tsx`
  - related player-analysis types only if needed
- acceptance criteria:
  - `PlayerAnalysisBenchmarkForm` no longer receives 20+ separate props.
  - Props are grouped into 2-4 cohesive objects:
    - `contextState`
    - `candidateState`
    - `benchmarkConfigState`
    - `benchmarkActions`
  - Existing UI behavior remains unchanged.
  - `typecheck`, `lint`, `build`, and `test` pass.
- verification:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`
  - `npm test`
- planned commit message: `refactor(player-analysis): group benchmark form props`

## Review

- none

## Done

- none
