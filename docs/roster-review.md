# Mythic Roster Review (officer workflow)

## Purpose

Answers the officer question: *given the players actually available for the next raid, which 20 give us the strongest Mythic progression roster, and can we explain every Start/Flex/Bench decision consistently?*

It is decision support, not a ranking machine. The app gathers Warcraft Logs evidence, organises it, lets officers compare candidates dimension by dimension, records a structured reason per decision, and exports an evidence pack for a second opinion from ChatGPT/Claude. There is no combined score and no automatic cutoff.

## Decision framework

1. Current performance — WCL **overall parse** (primary), median/latest/best, raw DPS/HPS.
2. Execution / consistency — spread of overall parse, best-vs-median, deaths on kill fights.
3. Attendance / reliability — **log presence** in the selected reports (labelled as such; not an absence verdict) plus officer-entered availability.
4. Preparation / gearing — item level from rankings (`bracketData`) and **ilvl-bracket parse** as secondary diagnostic context.
5. Composition / utility — class, spec, raid role (tank/healer/melee/ranged), officer judgement.

## Flow

`/roster-review` → Raid → Availability → Evidence → Select → Review → Export

1. **Raid**: name the target raid, pick 1–3 recent raid logs (`GET /api/roster-review/reports`), choose the evidence difficulty (Heroic is the normal source for a first Mythic roster), optionally filter bosses.
2. **Availability**: add players from the recent-player autocomplete, or "Add everyone in selected logs". Set raid role, availability (available / late / absent) and a note. Entries carry a `source` field so Raid-Helper ingestion can be added later without changing the model.
3. **Evidence**: `POST /api/roster-review/evidence` starts an async job; the UI polls `GET /api/roster-review/evidence/:jobId` and shows steps such as "Fetching rankings for …" and "Building evidence for …". Per player: overall/bracket percentiles (median, latest, best), item level, output, log presence, sat-out kill fights, deaths on checked kills, sample size, transparent signals, and a boss-by-boss table. Unknown stays unknown (`—`). One failed report or player does not stop the others.
4. **Select**: mark Start / Flex / Not selected per player, grouped by raid role. Role targets default to 20 / 2 tanks / 4 healers / 14 DPS and are editable; counts are displayed, never enforced.
5. **Review**: every decision gets a reason category and a short text (templates provided). "Compare" two players to get a dimension-by-dimension reading with visible thresholds and an editable draft explanation; save it as a comparison note.
6. **Export**: Markdown (evidence tables, tags, decisions, comparison notes, data warnings, LLM review prompt) and JSON. Copy to clipboard or download; large packs should be downloaded.

Session state (raid window, availability, decisions, notes, last evidence) persists in `localStorage` under `wcl-cmp.roster-review.v1`. No WCL data leaves the local app.

## WCL data used

- `reportData.report(code)`: `fights { id encounterID name kill difficulty startTime endTime friendlyPlayers }` and `masterData.actors` (presence and actor ids).
- `report.rankings(fightIDs: [...], timeframe: Historical)` with a fallback to the current-partition rankings for fights without historical rows. Character rows provide `rankPercent` (overall), `bracketPercent` (ilvl bracket), `bracketData` (item level), `amount` (DPS/HPS), `class`, `spec`, and role bucket. When `rankPercent` is missing the overall percentile is derived from `rank`/`totalParses` and labelled "Derived percentile".
- `report.events(dataType: Deaths)` per kill fight, matched by actor id.

Known limits: hidden/anonymous characters have no ranking rows (shown as unknown); wipes carry no parses; spec changes are surfaced as "Multiple specs"; presence is unknown when WCL omits `friendlyPlayers`; nothing in the pack claims to know whether an absence was excused.

## Heuristic tags (transparent, non-scoring)

| Tag | Rule |
|---|---|
| Strong recent evidence | median overall ≥ 75 across ≥ 3 ranked kills |
| Near role boundary | within two places of the role target when ordered by median overall parse |
| Limited evidence | < 3 ranked kills or no ranking data |
| Log presence note | missing from a selected log, or sat out kill fights |
| Availability note | marked late or absent |
| Gear note | item level 10+ below the median of the same raid role |

Comparison thresholds: 10 overall-parse points, 15 spread points, 8 item levels. They describe "material" differences and are shown in the UI; the conclusion is always written by an officer.

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/roster-review/reports` | recent raid reports with boss fights, kill counts per difficulty, participants (guild-scoped) |
| POST | `/api/roster-review/evidence` | body `{ reportCodes[], difficulty?, encounterIds?, playerNames[], wclContext? }` → 202 `{ jobId, statusUrl }` |
| GET | `/api/roster-review/evidence/:jobId` | job status, progress, warnings, result |

## Answering "why was X selected over Y?"

1. Evidence step: click "compare" on X and Y (or do it in Review).
2. Review step: read the comparison table (performance, consistency, log presence, gear, execution, availability, composition).
3. Edit the draft conclusion (for example "X selected: composition needs a Mage; performance roughly equal; Y's better attendance does not outweigh the requirement") and save it as a comparison note.
4. Record the reason on both players' decisions.
5. Export: the note, both reasons, and the underlying numbers travel together in the pack.
