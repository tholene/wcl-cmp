# Warcraft Logs Guild Analyzer (POC)

A local TypeScript + React app for reviewing recent Warcraft Logs reports for your guild.

## Stack

- React + Vite + TypeScript
- Tailwind CSS
- TanStack Query
- Express backend proxy for Warcraft Logs v2 GraphQL

## Local Ports

- Frontend: `http://localhost:5780`
- Backend: `http://localhost:5781` (or your custom `API_PORT`)
- OAuth callback placeholder: `http://localhost:5781/auth/callback` (adjust if using another API port)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create local env file:

```bash
cp .env.example .env
```

3. Fill in your real credentials in `.env`:

```bash
WCL_CLIENT_ID=...
WCL_CLIENT_SECRET=...
WCL_GUILD_ID=61324
WCL_REGION=EU
API_PORT=5781
VITE_DEV_SERVER_PORT=5780
WCL_REDIRECT_URI=http://localhost:5781/auth/callback
```

4. Start frontend + backend together:

```bash
npm run dev
```

## Available Endpoints

- `GET /api/health`
- `GET /api/config/status`
- `GET /api/reports/recent`
- `GET /api/reports/:code`
- `GET /api/bosses/recent`
- `GET /api/bosses/:encounterId/recent-fights`
- `GET /api/reports/:code/fights/:fightId/review`

Warcraft Logs API access remains server-side only via the local Express backend.

## Troubleshooting

If `GET /api/reports/recent` returns an env config error:

1. Ensure `.env` is in the project root (same folder as `package.json`).
2. Ensure values are `KEY=value` format (no `:` separators).
3. Ensure `WCL_CLIENT_ID` and `WCL_CLIENT_SECRET` are present and non-empty.
4. If you changed API port (for example `API_PORT=5782`), update:
   - request URL to `http://localhost:5782/...`
   - `WCL_REDIRECT_URI=http://localhost:5782/auth/callback`
5. Fully restart dev processes:

```bash
npm run dev
```

Check current non-secret config flags:

```bash
curl http://localhost:5781/api/config/status
```

(or replace `5781` with your configured `API_PORT`).

## Current POC Features

- Recent Reports Dashboard
- Report Details View with encounter list and fight metadata
- Boss Overview Index (`/bosses`)
- Boss Recent Pulls / Boss Detail View (`/bosses/:encounterId`)
- Fight Review Snapshot (`/reports/:code/fights/:fightId`)
- Links to open source reports in Warcraft Logs
- Loading/error/empty states

Not yet implemented (future backlog items):

- Player-specific fight review
- Structured AI review export (copy-paste prompt workflow)
- Local persistence/SQLite caching and review state
- Player profiles/trends and progression analytics

## Scripts

- `npm run dev` - run web + API in parallel
- `npm run dev:web` - run Vite app only
- `npm run dev:api` - run API only
- `npm run typecheck` - TypeScript validation
- `npm run lint` - ESLint
- `npm run build` - production build
