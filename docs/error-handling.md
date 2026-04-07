# Error handling

## `lib/db-errors.ts`

| Export | Role |
|--------|------|
| **`isDbConnectionError(e: unknown): boolean`** | Returns true for `Error` instances whose **lowercased** message contains: `fetch failed`, `etimedout`, `econnrefused`, or `error connecting to database`. |
| **`getDbErrorKey(error: unknown): DbErrorKey`** | Maps errors to **`connectionTimeout`** (if `isDbConnectionError`), else **`fetchFailed`** if message includes `"fetch failed"` (redundant branch for edge cases), else **`unknown`**. |
| **`DbErrorKey`** | `"connectionTimeout" \| "unknown" \| "fetchFailed"` |

Neon/serverless often surfaces timeouts as **`fetch failed`** or messages containing **`ETIMEDOUT`** / **`ECONNREFUSED`** — the string checks are intentionally broad.

## `lib/i18n-errors.ts`

- **`DB_ERROR_KEYS`** — Array of valid keys.
- **`isDbErrorKey(s)`** — Type guard so clients can translate only known keys.

## Client translation

- [`hooks/use-translate-action-error.ts`](../hooks/use-translate-action-error.ts) — `useTranslateActionError()` returns a function `(msg: string) => string` that maps `DbErrorKey` through **`next-intl`** namespace **`errors`**, and passes through other strings unchanged.

## Arabic (and English) user-facing messages

Defined under **`errors`** in message files:

| Key | Arabic (`messages/ar.json`) | English (`messages/en.json`) |
|-----|------------------------------|------------------------------|
| `connectionTimeout` | انتهت مهلة الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى. | Database connection timed out. Please try again. |
| `fetchFailed` | فشل في جلب البيانات. تحقق من اتصالك. | Failed to fetch data. Check your connection. |
| `unknown` | حدث خطأ غير متوقع. | An unexpected error occurred. |

Validation and domain errors from Zod often use **inline Arabic** strings in server actions (e.g. `team.ts` schemas).

## Server actions using `getDbErrorKey` + `isDbConnectionError`

`clients`, `expenses`, `files`, `invoices`, `project-services`, `projects`, `proposals`, `services`, `settings`, `tasks`, `team`, `team-members`.

Return shape is typically **`{ ok: false, error: getDbErrorKey(e) }`** or **`error: { _form: [getDbErrorKey(e)] }`** for forms.

## Partial pattern: `assignments.ts`

Uses **`isDbConnectionError`** only and returns **hard-coded Arabic** strings for DB failures (not `DbErrorKey`). UI cannot use `useTranslateActionError` for those without a string match.

**TODO:** Refactor to return `getDbErrorKey(e)` (or a shared helper) for consistent i18n.

## Not yet using `db-errors`

| Module | Behavior |
|--------|----------|
| **`actions/dashboard.ts`** | `getDashboardData()` — errors **throw**; no keyed error return. |
| **`actions/reports.ts`** | Report loaders **throw** on failure. |

**TODO:** Consider try/catch wrappers returning `{ ok: false, error: DbErrorKey }` or a typed `Result` so report pages can show friendly Arabic messages when Neon is cold.

## UI patterns

- **Toasts** — Sonner via [`components/ui/sonner`](../components/ui/sonner.tsx); many call sites pass translated strings.
- **Forms** — `error._form` arrays for non-field server errors.

## Current state addendum

<!-- ADDED 2026-03-23 -->

- `actions/workspace.ts` uses `isDbConnectionError` + `getDbErrorKey` consistently for DB/network errors.
- `actions/assignments.ts` still returns inline Arabic messages for several failure cases and is not fully normalized to `DbErrorKey`.
- `actions/dashboard.ts` and `actions/reports.ts` continue to throw on failure rather than returning `{ ok: false, error }`.
