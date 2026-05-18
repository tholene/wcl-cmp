# Player Analysis Export Runtime Smoke Checklist (WP6)

This checklist validates runtime status hardening for `/api/player-analysis/export` (`complete`, `partial`, `failed`) and related UI/API messaging.

## Preconditions

- Run locally:

```bash
npm run dev
npm run server:dev
```

- Open browser devtools (Network + Console).
- Use `/player-analysis`.

## A. Complete Export

- [ ] Generate an export with valid subject data and benchmark candidate(s) that export successfully.
- [ ] Verify status ends as `complete`.
- [ ] Verify progress panel uses success styling and does not report missing requested sections.
- [ ] Verify `bundle.zip` and individual files are downloadable.

## B. Partial Export (Skipped/Failed/Truncated Sections)

- [ ] Use a case where at least one requested section is skipped/failed (for example benchmark candidate skip, missing report/fight, or unavailable view endpoint).
- [ ] Verify status ends as `partial` (not `failed`).
- [ ] Verify progress panel text indicates export completed with partial data.
- [ ] Verify grouped breakdown appears (skipped candidates, skipped views, truncated views, warning groups).
- [ ] Verify results panel states ZIP is usable but incomplete.
- [ ] Verify download links remain usable for produced files.

## C. Truncation As Partial

- [ ] Force view-event truncation via low limits or large fights.
- [ ] Verify `partial` status.
- [ ] Verify truncated view entries include report/fight and row cap context.

## D. Failed Export

- [ ] Trigger a startup/runtime failure before usable subject bundle output.
- [ ] Verify terminal status is `failed`.
- [ ] Verify failed step/error details are shown.
- [ ] Verify no misleading success/partial copy is shown.

## E. Subject-only Override Messaging

- [ ] Configure benchmark requested but blocked/omitted, then enable `Export subject-only data without benchmark comparison`.
- [ ] Verify export can finish with subject files.
- [ ] Verify results include subject-only message with omission reason.
- [ ] Verify benchmark summary shows requested but not included.

## F. No Exportable Benchmark Candidate

- [ ] Auto benchmark mode with no exportable candidates and override disabled.
- [ ] Verify start/export is blocked by form guidance.
- [ ] Enable override and rerun.
- [ ] Verify resulting status/message explains benchmark omission clearly.

## G. API Envelope & Parse Resilience

- [ ] Send invalid JSON to `/api/player-analysis/export`.
- [ ] Verify JSON error response shape `{ error, hint?, code?, details? }`.
- [ ] Stop backend and trigger preview/export/status polling.
- [ ] Verify UI shows actionable runtime/API errors (no raw `Unexpected end of JSON input`).
- [ ] Simulate non-JSON/HTML response and verify frontend reports non-JSON error clearly.

## H. Status Polling Resilience

- [ ] Start export, then temporarily interrupt backend or `/status` responses.
- [ ] Verify repeated poll failures surface readable UI message.
- [ ] Restore backend and confirm next successful polls clear transient poll error.

## I. Download Endpoint JSON Errors

- [ ] Request download with invalid `exportId` or filename.
- [ ] Verify endpoint returns JSON `400` envelope (not HTML).
- [ ] Request missing file path for a valid export.
- [ ] Verify endpoint returns JSON `404` envelope.

## Pass/Fail Log

| Date | Tester | Result | Notes |
|---|---|---|---|
| YYYY-MM-DD | name | pass/fail | summary |
