# Player Analysis UX Smoke Test

Covers the 4-step vertical workbench introduced in the UX simplification slice (2026-05-21).

## Setup

Open the Player Analysis page. You should see **only** the Player step — no 3-column grid, no benchmark form visible yet.

---

## Step 1 — Player

- [ ] Page loads with a single large input ("Search for a player…") and a "Load boss kills" button
- [ ] Typing a known player name triggers autocomplete suggestions via `<datalist>`
- [ ] Selecting a name from autocomplete auto-triggers the preview (boss kill loading starts immediately, no manual click required)
- [ ] Pressing Enter in the input field also triggers the preview
- [ ] "Load boss kills" button always remains visible as a manual fallback
- [ ] Repeated autocomplete selection of the same name does **not** re-trigger (guarded by `lastAutoPreviewedName`)
- [ ] Advanced scope options are collapsed inside a `<details>` (timeframe, fight filters, manual reports all present)
- [ ] Advanced scope changes reset the preview (boss kill step disappears)

---

## Step 2 — Boss Kill

- [ ] Step 2 section appears once preview is loading or complete
- [ ] Loading state shows "Loading boss kills…" text
- [ ] Preview error shows a rose-colored error box with the error message
- [ ] Successful preview shows large selectable `BossKillCard` rows (encounter name, difficulty badge, duration, ilvl, date)
- [ ] Difficulty badges: Mythic = fuchsia, Heroic = indigo, Normal = emerald
- [ ] Clicking a card selects it (violet border + background); clicking another switches selection
- [ ] "No raid boss kills found in this scope." message shown when no kills in scope
- [ ] "Advanced fight selection & scope details" `<details>` is collapsed by default but opens to show the full `PlayerAnalysisPreviewPanel` with scope stats, player detection, and fight checkbox grid
- [ ] Selecting a boss kill auto-triggers benchmark candidate discovery (Step 3 appears)

---

## Step 3 — Benchmark

- [ ] Step 3 section appears once a boss kill is selected
- [ ] Context badge shows detected class/spec (e.g. "Arms Warrior — WCL detected") or prompts for class/spec override
- [ ] When auto-triggered, shows "Searching for same-spec benchmark candidates…" spinner text (no button)
- [ ] After auto-trigger completes, candidate rows appear (or "no candidates found" message)
- [ ] Recommended candidate pre-highlighted (sky border)
- [ ] Selecting a candidate highlights it (violet border)
- [ ] Non-exportable candidates show reasons in rose text and cannot be selected
- [ ] "Refresh candidates" secondary button available after initial load
- [ ] Advanced benchmark options in collapsed `<details>` (percentile, metric, ilvl window, duration window, class/spec override, mode toggle)
- [ ] Subject-only override checkbox visible when `benchmarkMode='auto'` and no exportable candidate found

---

## Step 4 — Export

- [ ] Step 4 section appears once a fight is selected (regardless of benchmark state)
- [ ] When `benchmarkMode='auto'` and candidates are still loading: "Finding same-spec benchmark candidates…" message shown
- [ ] When `benchmarkMode='auto'` and no exportable candidate found: clear message with fallback instructions; export button disabled
- [ ] When benchmark is resolved (or `benchmarkMode='none'`, or subject-only override enabled): export summary shown (player name, boss, benchmark player if selected)
- [ ] "Export analysis bundle" button is full-width, prominent violet
- [ ] Export blocked reason shown in amber text when applicable
- [ ] Progress bar/status appears during export polling
- [ ] Results panel shows: status badge, prominent "Download bundle.zip" button, "Upload to ChatGPT" instruction, collapsed "Export summary" details, "Start over" button
- [ ] "Start over" resets to Step 1

---

## Global Advanced Options

- [ ] "Advanced options" `<details>` at bottom of page contains the views form (export view checkboxes)
- [ ] Changing views does not reset player/boss/benchmark state

---

## No Regressions

- [ ] Manual benchmark entry still works (switch mode in advanced benchmark options)
- [ ] Manual report selection still works (advanced scope options → scope mode → Manual report selection)
- [ ] Subject-only export (no benchmark) still works via the subject-only override checkbox
- [ ] Latest raid detection still shows detected reports in the advanced scope section
