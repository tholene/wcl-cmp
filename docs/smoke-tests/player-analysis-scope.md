# Player Analysis Scope Smoke Checklist (WP6a)

This checklist validates WP1 player-analysis scope/preview/fight-selection behavior manually, without adding test infra.

## Preconditions

- App dependencies installed (`npm install` already completed).
- Backend has valid WCL credentials in local `.env` if doing real-data checks.
- Run the app locally in two terminals:

```bash
npm run dev
npm run server:dev
```

- Open browser devtools (Network + Console) before starting checks.

## Route Open Checks

- [ ] Open `/` and verify app shell renders without console/runtime errors.
- [ ] Open `/player-analysis` and verify the Player Analysis Export page renders.
- [ ] Confirm no immediate React crash (blank page, red error overlay, or `.map` on undefined style failure).

## Player Input And Autocomplete Fallback

- [ ] Confirm `Character name` input is visible and editable.
- [ ] Type a name manually (for example `Fink`) and confirm manual entry works regardless of autocomplete state.
- [ ] If recent players load: confirm datalist suggestions appear while typing.
- [ ] If recent players fail: confirm warning text indicates autocomplete failed and manual entry still works.

Expected warning text behavior:
- Shows a non-blocking warning (autocomplete failure), not a hard-stop error.
- Preview remains possible with manual character input.

## Default Scope (`latestRaid`)

- [ ] Confirm `Scope mode` defaults to `Latest raid (default)`.
- [ ] Verify latest-raid helper panel appears.
- [ ] If reports load successfully and latest raid exists, verify report codes/titles are listed.
- [ ] If reports fail/empty, verify clear non-crashing fallback text appears.
- [ ] Click `Preview export` and confirm preview request is sent to `POST /api/player-analysis/export-preview`.

Expected:
- Request succeeds or fails with a clear UI message.
- No runtime crash on empty report lists.

## Manual Report Selection (`manualReports`)

- [ ] Switch `Scope mode` to `Manual report selection`.
- [ ] Verify report list area appears.
- [ ] If reports exist: test checkbox selection of one/multiple reports.
- [ ] Test `Select all` populates all report checkboxes.
- [ ] Test `Clear` removes all selected reports.
- [ ] Confirm preview button is disabled when no reports are selected in manual mode.

Expected:
- `Select at least one report for manual scope.` appears when manual mode has zero selected reports.
- No crash when reports array is empty.

## Preview Behavior And Diagnostics Expectations

- [ ] Trigger preview with valid inputs.
- [ ] Verify preview panel renders scope counts (reports/fights scanned/included).
- [ ] Verify warnings are shown as warning callouts rather than throwing.
- [ ] Verify class/spec detection diagnostics appear only as informational hints when confidence is not high.

Expected:
- Preview endpoint behavior is diagnostics-forward and failure-tolerant.
- No uncaught JSON parsing/render errors in frontend.

## Fight List Rendering

- [ ] In preview, verify `Fight selection` list renders grouped by report.
- [ ] Verify each fight row shows encounter name, fight ID, difficulty, kill/wipe, duration, and player present/absent state.
- [ ] Verify WCL report title link is present and clickable.
- [ ] Verify empty-fight states show readable text (`No fights included from this report.`) without crashing.

## Fight Selection Controls

- [ ] Click `Default selection` and confirm eligible fights are selected.
- [ ] Click `Clear` and confirm all fight selections are removed.
- [ ] Manually deselect one fight, then reselect it.
- [ ] Confirm selected fight count updates correctly.
- [ ] Confirm `Generate export` is disabled when selected fights count is zero.

Expected:
- Guard text appears: `Select at least one fight to export.` when selection is empty.
- Export cannot be started with zero selected fights.

## Stale Preview Reset On Scope Changes

After a successful preview:

- [ ] Change `Character name` and verify previous preview/fight selections reset.
- [ ] Change `Scope mode` and verify previous preview/fight selections reset.
- [ ] Change include toggles (`Include kills`, `Include wipes`, `Only fights where player is present`) and verify reset.

Expected:
- Stale preview state is cleared on scope-affecting changes.
- Old fight selection does not persist incorrectly across changed scope inputs.

## Export Payload Check (`fightIdsByReport`)

- [ ] With preview loaded and custom fight selection made, click `Generate export`.
- [ ] In browser Network tab, inspect `POST /api/player-analysis/export` request payload.
- [ ] Verify `fightIdsByReport` exists and includes only currently selected fights per report code.
- [ ] Verify deselected fights are absent from payload.

## WP3 Class/Spec Override Checks

- [ ] Trigger preview where WCL does not return complete class/spec (or mock preview with missing spec).
- [ ] In Benchmark Comparison (auto mode), confirm WCL-detected context block is visible with class/spec/role/confidence/source fields.
- [ ] If class/spec missing, confirm message appears exactly:
  `WCL did not detect class/spec for this player. Select class/spec manually to enable benchmark discovery.`
- [ ] Select class first, then spec (filtered by selected class); confirm role display updates from selected spec.
- [ ] Confirm benchmark discovery button remains disabled until:
  - preview exists
  - at least one baseline fight is selected
  - class/spec available via WCL-detected or user-provided context
- [ ] If class/spec still unavailable, confirm message appears exactly:
  `Benchmark discovery requires class and spec. WCL did not detect spec, so select it manually.`
- [ ] If WCL and user-provided context differ, confirm warning is shown in UI.
- [ ] Inspect `POST /api/player-analysis/export-preview` request and verify `playerContext` is included when manually selected.
- [ ] Inspect `POST /api/player-analysis/export` request and verify `playerContext` is included when manually selected.
- [ ] Run an export and confirm `manifest.json` includes:
  - `detectedContext`
  - `userContext`
  - `effectiveContext`
  - `contextWarnings`
- [ ] Confirm `README.md` Player Context section includes WCL-detected, user-provided, and benchmark/export context used.

## Raid-Only Latest Scope Checks

- [ ] Keep `Scope mode` at `Latest raid (default)`.
- [ ] Verify non-raid recent logs (M+, dungeon, arena) are excluded from the latest-raid local helper list.
- [ ] If no raid logs are available, verify warning appears:
  `No recent raid logs found. Try manual report selection.`
- [ ] Trigger preview and confirm the same warning can appear in preview warnings without crashing.

## One-Boss Default And Multi-Fight Opt-In

- [ ] After preview, verify exactly one eligible boss fight is selected by default (prefer kill when available).
- [ ] Verify `Analyze this boss` re-applies one-fight selection.
- [ ] Verify `Include more fights` expands selection to all eligible player-present boss fights.
- [ ] Verify export payload `fightIdsByReport` reflects the current explicit selection.

## Explicit Benchmark Candidate Selection

- [ ] Run auto benchmark discovery.
- [ ] Verify each baseline group shows all returned candidates (including non-exportable entries).
- [ ] Verify recommended candidate badge is visible when backend provides one.
- [ ] Verify user can select another exportable candidate explicitly.
- [ ] Verify non-exportable candidates are disabled and show reasons.
- [ ] Inspect export payload and confirm `benchmark.selectedCandidates` contains only explicitly selected candidate(s).

## Candidate Row Metrics And Delta Checks

- [ ] Verify candidate rows show:
  - player name
  - parse percentile
  - rank
  - metric amount
  - `Ranking ilvl` label
  - duration
  - ilvl delta vs baseline (when baseline ilvl is known)
  - duration delta vs baseline (when baseline duration is known)
- [ ] Verify availability badges show exportable/not exportable, plus selected/recommended where applicable.

## README Instruction + Item-Level Correctness Checks

- [ ] Run export and open `README.md`.
- [ ] Verify README begins with `# Player Analysis Export Bundle`.
- [ ] Verify README includes explicit AI instruction section with English output requirement and required output structure.
- [ ] Verify player item level in README uses subject CombatantInfo item level when available (not forced unknown).
- [ ] Open `manifest.json` and benchmark candidate JSON (`benchmark-candidates.json` or `benchmark-candidate.json`) and verify both item-level sources are present:
  - ranking-sourced benchmark item level
  - benchmark CombatantInfo item level (if available)
- [ ] Verify mismatch warning appears when `abs(ranking ilvl - combatantInfo ilvl) > 3`.

## Empty/Missing Array Safety

Validate each view handles empty arrays safely (no React crash):

- [ ] `players` empty or failed recent players request.
- [ ] `reports` empty or failed recent reports request.
- [ ] `preview.includedReports` empty.
- [ ] `includedFights` empty for one or more included reports.
- [ ] `warnings` arrays empty.

Expected:
- Graceful fallback text in all cases.
- No `Cannot read properties of undefined` or `.map` on undefined errors.

## Failure-Case Checks

- [ ] Simulate backend unavailable (stop server) and click preview.
- [ ] Confirm clear UI error message appears (for example no-body/non-JSON/server error hint).
- [ ] Restore backend and verify page recovers after retry.
- [ ] If WCL fails upstream for one request, verify warnings/errors are user-readable and the app stays interactive.

Expected:
- Clear failure messaging, no full-page crash.
- Retry path works once service is restored.

## Optional Mocked / No-WCL Workflow

Use devtools Network request blocking or response overrides to test without live WCL:

- [ ] Override `POST /api/player-analysis/export-preview` with a minimal valid JSON preview payload.
- [ ] Verify preview UI renders and fight-selection controls still work.
- [ ] Override with error payload/status and verify frontend error handling behavior.

Suggested minimal mocked preview shape:
- `scope` object with non-negative counters.
- `includedReports` array with at least one report and one fight.
- `estimatedExport` object.
- `warnings` array (may be empty).

## Pass/Fail Recording

Record each smoke run for repeatability.

| Date | Tester | Environment | Result | Notes / Failures |
|---|---|---|---|---|
| YYYY-MM-DD | name | local dev | pass/fail | short notes |

## Out Of Scope For WP6a

- Adding Playwright smoke automation.
- Adding `test:smoke` scripts.
- Changing benchmark selection logic.
- Changing export enrichment behavior.
