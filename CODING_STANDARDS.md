# Coding Standards — std-analyzer

> Adapted from the nxtdr-mono CODING_GUIDELINES. This is a single-app repo, so shared-package conventions map to `src/lib/` shared utilities instead.

---

## First principles

1. **Prefer simple, explicit architecture.** If a pattern requires explanation every time it is used, it is the wrong pattern.
2. **Minimize sources of truth.** One rule in one place. Shared utilities live in `src/lib/` — do not duplicate them per-feature.
3. **Prefer shared primitives over local custom implementations.** Check `src/lib/` and existing feature patterns before building locally.
4. **Consistency is a feature.** When in doubt, follow the existing patterns in the stronger parts of the codebase.
5. **Avoid broad rewrites.** Prefer small, reviewable slices. Do not introduce unrelated refactors while solving a task.

---

## Component conventions

### Always annotate with `FC`

```ts
// ✅
export const ReportListCard: FC<ReportListCardProps> = ({ report }) => (...)

// ❌
export const ReportListCard = ({ report }: ReportListCardProps) => (...)
```

### Arrow functions with `export const`

```ts
// ✅
export const useRecentReports = () => useQuery(...)
export const formatDuration = (ms: number) => ...

// ❌
export function useRecentReports() { ... }
```

### Implicit returns for single-expression bodies

```ts
// ✅
const double = (x: number) => x * 2
const MyCard: FC = () => <div>Hello</div>

// ❌
const double = (x: number) => { return x * 2 }
```

### Props

- Inline prop type (`type ReportListCardProps = { ... }`) immediately above the component, in the same file.
- For domain/shared types that cross file boundaries: one type per file in `types/`.
- Keep props narrow — only pass what is actually rendered or used.
- Target ≤ 10 props per component. If you exceed this, extract a custom hook or lift state.

---

## Data access (REST → Service → Hook)

All three layers must exist. Do not collapse or skip.

### Layer 1: REST service (`api/*-rest.service.ts`)

- Raw HTTP calls using the shared `apiFetch` utility from `src/lib/http-client.ts`.
- **No try-catch** — errors surface to React Query which handles retry and error state.
- No business logic, no store sync, no data transformation.

```ts
import { apiFetch } from '@/lib/http-client'
import { apiUrl } from '@/lib/api-base-url'

export const ReportsRestService = {
  listRecentReports: (): Promise<RecentReportsResponse> =>
    apiFetch(apiUrl('/api/reports/recent')),

  getReportDetails: (code: string): Promise<ReportDetails> =>
    apiFetch(apiUrl(`/api/reports/${code}`)),
}
```

### Layer 2: Domain service (`services/*.service.ts`)

- Calls REST service; may transform data, call mappers, or sync stores.
- Must exist even if currently a pass-through — it is the stable interface for hooks.
- Re-export types for consumer convenience.

### Layer 3: React Query hooks (`hooks/use-*.ts`)

- Never import from `api/` directly — only from `services/`.
- Queries call the service. Mutations invalidate relevant query keys on success.
- Query keys come from `src/lib/query-keys.ts`.

```ts
export const useRecentReports = () =>
  useQuery({
    queryKey: queryKeys.reports.recent(),
    queryFn: ReportsService.listRecentReports,
  })
```

---

## Shared HTTP client

All REST services use `apiFetch` from `src/lib/http-client.ts`. It handles:

- Empty body (502/503 hint)
- HTML-response detection
- Structured error responses via `ApiErrorResponse` (`error`, `code`, `hint`)
- Non-JSON error bodies

Do not call `fetch()` directly in REST services. Do not inline try/catch/parse logic.

---

## State management

- **≤ 5 `useState` per component** is a soft limit. Beyond that, extract to `useReducer` or a dedicated hook.
- Complex feature state (many related fields) belongs in a `use*-state.ts` hook backed by `useReducer`.
- Pass `state` + `dispatch` to sub-containers instead of individual props.
- Do not use React Context for feature-local state — pass explicitly or lift into a hook.

---

## Styling

- **Tailwind only** — no inline `style` props, no hardcoded RGBA/hex strings in components.
- Brand colors and surface tones are CSS custom properties in `src/index.css`, exposed as Tailwind tokens.
- Use `cn()` from `src/lib/utils.ts` for conditional class composition.
- Dark-mode: use Tailwind `dark:` variants or CSS variables; never light-mode-only assumptions.

---

## Validation / schema

- Zod is available. Use it for:
  - Form validation (pass `zodResolver` to React Hook Form).
  - Runtime validation of REST responses in high-risk flows.
- Keep schemas close to where they are used: in `types/` for the feature, in `src/lib/` only if used across features.
- Do not duplicate schema definitions.

---

## TypeScript

- `strict: true` — always. No `any`. Use `unknown` and narrow.
- `noUnusedLocals` and `noUnusedParameters` are enforced by tsconfig.
- Use `as const` on fixed objects and tuples.
- Prefer discriminated unions over optional fields for variant shapes.

---

## Testing (Vitest)

- Test framework: Vitest + `@testing-library/react` + `@testing-library/user-event`.
- Tests live in `__tests__/` next to the file under test.
- Test file naming: `kebab-case.test.ts(x)`.
- **Mock at the hook boundary** — mock `use-*` hooks in container tests, not the service or REST layer.
- Test factories live in `src/test/factories/*.ts` — never inline raw objects in test files.
- Every behavior change must include a focused test covering the happy path + at least one denial/error path.
- Do not claim verification passed unless you actually ran `npm test`.

---

## Naming

| What | Pattern | Example |
|---|---|---|
| Files | `kebab-case` | `recent-reports-response.ts` |
| Components | PascalCase export | `ReportListCard` |
| Hooks | `use` prefix, camelCase | `useRecentReports` |
| Services | PascalCase, `*Service` | `ReportsService` |
| REST services | PascalCase, `*RestService` | `ReportsRestService` |
| Mappers | PascalCase, `*Mapper` | `ReportsMapper` |
| Constants | `SCREAMING_SNAKE_CASE` | `PATHS`, `STABLE_EXPORT_VIEWS` |
| Query key factories | camelCase, callable form | `queryKeys.reports.recent()` |

---

## Query keys

All query keys live in `src/lib/query-keys.ts`. Per-feature keys that existed inline must be consolidated there.

```ts
export const queryKeys = {
  reports: {
    all: ['reports'] as const,
    recent: () => [...queryKeys.reports.all, 'recent'] as const,
    detail: (code: string) => [...queryKeys.reports.all, code] as const,
  },
  // ...
} as const
```

---

## Routes

All route paths are defined in `src/lib/routes.ts`. Never hardcode route strings in components or hooks.

---

## Git / PR hygiene

- One concern per PR — do not bundle unrelated refactors.
- Phase large changes: (1) foundation/utility, (2) service layer, (3) UI, (4) tests.
- Run `npm run typecheck && npm run lint` before every commit.
