# WCL Compare

A local-first Warcraft Logs export workbench for guild officers. Pull fight data for any raider, auto-discover a same-spec benchmark player, and generate a structured export bundle for AI-assisted performance review.

## What it does

1. **Select a player** — search recent guild logs to find a raider and their boss kills
2. **Pick a fight** — choose a boss kill (or multiple) to analyze, grouped by encounter and difficulty
3. **Find a benchmark** — automatically discover a comparable player of the same spec, or select one manually
4. **Export** — download a ZIP containing CSVs and JSON with event data for the subject and benchmark

The exported bundle is designed to be uploaded to an AI analysis tool (ChatGPT, Claude, etc.) for structured performance coaching.

## Stack

- React 19 + Vite + TypeScript
- Tailwind CSS v4
- TanStack Query v5
- React Router v7
- Express 5 backend proxy for Warcraft Logs v2 GraphQL

## Local Ports

- Frontend: `http://localhost:5780`
- Backend: `http://localhost:5781` (or your custom `API_PORT`)
- OAuth callback: `http://localhost:5781/auth/callback`

## Setup

1. Install dependencies:

```bash
pnpm install
```

Deployment note:
- Render/Cloudflare deployments should use `pnpm`.
- Use frozen lockfile installs only when `pnpm-lock.yaml` is committed and current.
- Prefer `pnpm install --frozen-lockfile && pnpm run build` over semicolon chaining.

2. Create local env file:

```bash
cp .env.example .env
```

3. Fill in your credentials in `.env`:

```bash
WCL_CLIENT_ID=...
WCL_CLIENT_SECRET=...
# Optional defaults (can also be set in Settings):
# WCL_GUILD_ID=61324
# WCL_REGION=EU
API_PORT=5781
VITE_DEV_SERVER_PORT=5780
WCL_REDIRECT_URI=http://localhost:5781/auth/callback
```

`WCL_CLIENT_ID` and `WCL_CLIENT_SECRET` come from your [Warcraft Logs API client](https://www.warcraftlogs.com/api/clients/).
`WCL_GUILD_ID` and `WCL_REGION` are optional environment fallbacks. Request/settings values take precedence.

4. Start frontend + backend together:

```bash
pnpm dev
```

## Features

- Player lookup from recent guild raid reports
- Boss kill list grouped by encounter and difficulty
- Benchmark auto-discovery by class/spec, or manual selection
- Export scope preview before committing to a job
- Async export with job status polling and progress indicators
- ZIP/CSV/JSON output with local download endpoints
- Advanced sidebar: timeframe presets, report filtering, benchmark mode override, kills/wipes toggle
- Structured warnings for partial or incomplete export data

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Server status |
| `GET` | `/api/config/status` | WCL credential check |
| `GET` | `/api/reports/recent` | Recent guild raid reports |
| `GET` | `/api/players/recent` | Recent guild players |
| `POST` | `/api/player-analysis/export-preview` | Preview export scope |
| `POST` | `/api/player-analysis/export` | Start async export job |
| `GET` | `/api/player-analysis/exports/:id/status` | Poll job status |
| `GET` | `/api/player-analysis/exports/:id/:filename` | Download export file |
| `POST` | `/api/player-analysis/benchmark-candidates` | Find benchmark players |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run frontend + backend in parallel |
| `pnpm dev:web` | Frontend only (Vite) |
| `pnpm dev:api` | Backend only (Express) |
| `pnpm build` | Production build |
| `pnpm typecheck` | TypeScript validation |
| `pnpm lint` | ESLint |
| `pnpm test` | Run tests (Vitest) |
| `pnpm test:coverage` | Test coverage report |

## Troubleshooting

**API calls return an env config error:**

1. Ensure `.env` is in the project root (same folder as `package.json`).
2. Ensure values are `KEY=value` format — no quotes, no `:` separators.
3. Ensure `WCL_CLIENT_ID` and `WCL_CLIENT_SECRET` are present and non-empty.
4. If you changed `API_PORT`, update `WCL_REDIRECT_URI` to match.
5. Restart dev processes:

```bash
pnpm dev
```

**Check live config (non-secret fields only):**

```bash
curl http://localhost:5781/api/config/status
```
