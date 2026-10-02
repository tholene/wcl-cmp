# Mechanic Audit Export: Mythic L'ura Phase 1

## What this is for

Officers reviewing Mythic L'ura pulls sometimes need to know whether a Phase 1
mechanic failure (Glaives, Beams) is spread across the roster or concentrated
on specific players. This feature scans a set of raid reports, counts
mechanic hits per player, and exports CSV/JSON/Markdown/ZIP evidence for
officer review.

**This is not a general raid analyzer, not AI coaching, and it does not
automatically shame players.** The exported "review candidate" flag is a
starting point for a conversation, not a verdict — it only fires when all of
several conservative thresholds are met (see [Review candidates](#review-candidates-and-classification)
below), and every export includes the denominators and warnings needed to
sanity-check the result before acting on it.

## Officer workflow

1. Open **Mechanic Audit** from the nav strip (`/mechanic-audit`).
2. **Configure scope & mechanics** (step 1):
   - Pick a date range, or paste specific report codes if you already know
     which raid nights to include.
   - Enter the verified L'ura encounter ID and difficulty (Mythic = 5).
   - Add or edit mechanics (Glaives, Beams are pre-seeded) with their
     **verified** ability IDs — see [Finding ability IDs](#finding-ability-ids)
     below if you don't have them yet.
   - Choose how Phase 1 is bounded (see [Phase 1 boundary strategies](#phase-1-boundary-strategies)).
3. Click **Preview pulls**. This is a cheap scan — it confirms how many
   reports/fights matched and whether each mechanic's ability IDs actually
   appear in a sample of the data, without fetching every event yet.
4. Review the preview. If a mechanic shows "no sample hits found," double
   check the ability ID before continuing — exporting with a wrong ID will
   silently produce all-zero results.
5. Click **Export mechanic audit**. This fetches and aggregates the full
   event set in the background; progress is shown live.
6. Download the ZIP bundle (or individual CSV/JSON/README files) once the
   export completes. Read the bundle's `README.md`/`summary.md` before
   sharing conclusions — it explains denominators, dedup, and known caveats
   for that specific run.

Use the **Advanced** panel (gear icon, top right) to override the
review-candidate thresholds if the defaults don't fit your roster size or
pull count.

## Finding ability IDs

Ability IDs must be verified against real log data — this feature never
invents or guesses them. To find the ability ID(s) behind a mechanic:

```bash
npm run spike:list-fight-damage-abilities -- --report=<reportCode> --fight=<fightId>
```

This fetches `DamageTaken` events for one fight and prints every ability
that hit a player during it, sorted by event count, with unique-target
counts and first/last timestamps. Cross-reference against a pull where you
know the mechanic happened (e.g. via the WCL report viewer) to confirm which
ability ID(s) correspond to Glaives vs Beams.

You can optionally narrow the window with `--start-ms=<ms> --end-ms=<ms>`
(fight-relative) if the fight is long and you want to isolate a specific
mechanic window.

## Phase 1 boundary strategies

Since only Phase 1 mechanic failures are in scope, every pull needs a
resolved "end of Phase 1" boundary. Three top-level strategies are
supported:

- **Phase transition event** — uses the WCL-reported phase number where
  Phase 1 ends (fastest, works when the fight has clean phase events). This
  is L'ura's recommended default. See **No-transition fallback** below for
  what happens when the transition record is missing.
- **Marker ability cast** — uses the first cast of a specific ability
  (e.g. a phase-change spell) as the boundary. Useful if phase events aren't
  reliable but a spell cast reliably marks the transition.
- **Fixed fight-relative timestamp** — a manual, explicit fallback only. It
  clamps to the fight's own duration and is always labelled approximate in
  the export; it is never auto-selected and never silently replaces
  transition-plus-fight-end handling for normal progression wipes.

Pulls where the configured boundary can't be resolved (e.g. no phase
transition event found, or the marker ability never fires, with no fallback
configured or the fallback itself unable to resolve) are **excluded with a
warning**, not silently dropped or treated as "Phase 1 never ended."

### No-transition fallback (phase-transition mode only)

Real logs sometimes lack a recorded phase-transition event even when the
pull clearly reached Phase 2 (or never left Phase 1). The phase-transition
strategy supports an explicit, visible fallback for this — it is **never**
a hidden default; you must opt in:

- **Exclude (default)** — the prior, exclusion-only behavior. No transition
  record means the pull is dropped from analysis for that mechanic, with a
  warning.
- **Fight-end for wipes** — on a wipe with no transition record, treats the
  fight's end time as the Phase 1 boundary (i.e. "this pull never left
  Phase 1"). This is a low-severity **diagnostic**, not an exclusion — it
  does not appear in the grouped exclusion warnings.
- **Marker ability, then fight-end for wipes** — tries a configured marker
  ability first; if it never fired, falls back to fight-end for wipes.

**A kill can never use the fight-end fallback.** A fight ending in a kill is
itself proof that later phases were reached (this is a linear multi-phase
encounter), so "the pull never left Phase 1" is provably false for a kill —
only the marker-ability fallback (if configured and the marker fired) or
exclusion applies. A kill with an unresolved transition and no usable
marker is excluded with a data-quality warning, not silently assumed
all-Phase-1.

L'ura's recommended preset is phase-transition mode with the fight-end
fallback enabled for wipes — but this is exposed as explicit, visible
configuration in the mechanics form, not a value baked silently into the
pipeline.

## Interpreting player and pull summaries

The export includes three CSVs:

- `lura-p1-events.csv` — every deduplicated mechanic hit, one row per
  player/mechanic/pull occurrence.
- `lura-p1-player-summary.csv` — per player, per mechanic: eligible pulls,
  hit pulls, hit rate, and whether they're flagged as a review candidate.
- `lura-p1-pull-summary.csv` — per pull, per mechanic: whether it occurred,
  who was eligible, and who was hit.

**"Eligible pulls" is the denominator that matters**, not raw hit count. A
player who raids every night will accumulate more raw hits than someone who
missed three raids, even if their per-pull failure rate is identical or
lower. A player is only counted as eligible for a pull+mechanic if they were
present, Phase 1 resolved for that pull, the mechanic actually occurred, and
they were alive for at least one occurrence — always compare **hit rate**,
not absolute counts, across players.

### Whether the mechanic occurred at all

Whether a mechanic "occurred" on a pull is not derived solely from damage
taken, since a mechanic that everyone dodged would otherwise be
indistinguishable from a mechanic that never fired. Each mechanic can
optionally configure `occurrenceAbilityIds` + `occurrenceEventType`
(a boss cast, debuff, or buff event that's independent of any player being
hit). Every pull/mechanic in `lura-p1-pull-summary.csv` carries a
`mechanicOccurrenceQuality`:

- `verified` — either independent occurrence evidence was found in Phase 1,
  or occurrence evidence was configured and checked and genuinely found
  nothing (a confident, checked absence).
- `approximateFromDamage` — occurrence is inferred only from a damage hit
  landing (no occurrence config was checked, or it was checked but the hit
  itself is the only signal). A zero-hit pull with no occurrence config is
  never reported as a confirmed "did not occur" — it's an unconfirmed
  approximation.

Configuring `occurrenceAbilityIds` is optional but recommended for
mechanics with a meaningful dodge rate, since without it "did not occur" and
"was fully dodged" are not distinguishable.

## Review candidates and classification

A player is flagged as a review candidate for a mechanic only when **all**
of the following hold (defaults shown; adjustable in Advanced):

- At least `minimumEligiblePulls` (15) eligible pulls.
- Failures on at least `minimumRaidNightsWithFailure` (3) distinct raid
  nights (in the configured timezone), not just clustered in one session.
- Their hit rate exceeds the guild average by at least
  `guildAverageMultiplier` (1.5x) **and**
- exceeds it by at least `minimumAbsoluteRateDelta` (0.05) in absolute terms.

The guild average itself is exposure-weighted (players with more eligible
pulls count proportionally more), so a small sample doesn't skew it.

Distribution classification (`concentrated` / `mixed` / `distributed` /
`insufficientData`) is a separate, roster-wide read on whether a mechanic's
failures cluster on a few players or spread across the raid — it uses
neutral wording deliberately and is meant to guide where to look, not to
name anyone.

Classification becomes `insufficientData` whenever the raw sample is too
small (fewer than 10 eligible pulls or 8 eligible players) **or** when too
much of the matched sample had to be excluded (less than 50% of matched
fights actually included) — a large-looking raw pull count is not enough if
most of it was thrown out along the way. When no player clears
`minimumEligiblePulls`, the export does not present "review candidates: 0"
as a meaningful finding; it surfaces an explicit "Review-candidate
evaluation unavailable" note instead, both in the summary CSV and the
README.

## Cross-report duplicate detection

The same pull sometimes ends up in more than one report (re-uploads,
overlapping guild logs, etc.). Before aggregation, all discovered fights
across every scanned report are checked against each other using a
conservative fingerprint: encounter, difficulty, absolute start time and
duration within a small tolerance, boss percentage, and roster overlap.
**Duration alone is never enough** — two unrelated pulls of similar length
are not treated as duplicates.

Matched groups keep one canonical fight (only it is fetched for
event-level data and counted in aggregates) and mark the rest as
duplicates, recorded per-fight as `duplicateGroupId`, `canonicalReportCode`,
`duplicateReportCodes`, and a `deduplicationConfidence` (`high`/`medium`/
`low`) in `lura-p1-pull-summary.csv` and `manifest.json`. This pass does not
attempt to fingerprint on mechanic-event timing (events haven't been
fetched yet at this stage) — documented as a limitation, not implemented.

## Warnings and exclusions

Per-fight exclusion reasons (missing Phase 1 boundary, event-fetch
failures, duplicate pulls, etc.) are grouped by category with counts in the
README and the top-level warnings list, instead of repeating the same
warning once per fight — a run with hundreds of excluded pulls produces one
rollup line per category, not hundreds of near-identical lines. Full
per-fight detail (report code, fight ID, reason, category) is always
retained in `manifest.json` for anyone who needs to audit individual pulls.
Once the fight-end fallback (above) resolves a wipe, that pull is **not**
counted as an exclusion — it appears as data, with the fallback noted on
its own row, not in the exclusion warnings.

## Known limitations

- "Alive for at least one occurrence" is a conservative approximation of
  eligibility, not an exact death-timing reconstruction — see the
  data-quality warnings in the export if this matters for your pull set.
- Phase-boundary resolution quality depends entirely on the strategy chosen
  and how consistently that phase/ability/timing behaves pull-to-pull;
  excluded-pull warnings in the manifest tell you how much data was dropped.
- Cross-report duplicate detection does not fingerprint on mechanic-event
  timing, only fight-level metadata (start time, duration, outcome, boss %,
  roster overlap).
- This feature does not fetch every event for every player individually
  (unlike Player Analysis) — it batches per report, which is fast but means
  a malformed report can affect multiple fights' worth of data at once. Report
  failures are surfaced as partial-export warnings, not silent gaps.

## Example API request

```
POST /api/mechanic-audits/preview
Content-Type: application/json

{
  "scope": { "mode": "dateRange", "since": 1700000000000, "until": 1705000000000 },
  "encounter": { "encounterId": 3010, "difficulty": 5, "encounterName": "L'ura, the Waking Storm" },
  "mechanics": [
    {
      "key": "glaives",
      "label": "Glaives",
      "abilityIds": [123456],
      "occurrenceAbilityIds": [123458],
      "occurrenceEventType": "Casts"
    },
    { "key": "beams", "label": "Beams", "abilityIds": [123457] }
  ],
  "phaseOneBoundary": {
    "mode": "phaseTransition",
    "phase": 2,
    "noTransitionFallback": { "mode": "fightEndForWipes" }
  },
  "timezone": "Europe/Stockholm",
  "wclContext": { "wclSite": "retail", "guildId": "61324" }
}
```

## Example CLI command

```bash
npm run spike:list-fight-damage-abilities -- --report=AbC123XyZ --fight=7
```
