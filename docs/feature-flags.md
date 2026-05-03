# Plan-based feature flags and usage

## Registry

Feature keys, default plan inclusion, and descriptions live in `lib/feature-registry.ts` (`FEATURE_REGISTRY`). Per-tenant overrides use the `organizations.features` JSONB column: set a feature key to `true` to enable or `false` to disable regardless of plan defaults.

Shared evaluation (plan + overrides) is implemented by `evaluateFeatureAccess()` in the same module so client hooks can mirror server rules without importing server-only code.

## Server

- `lib/features.ts` — `hasFeature(organizationId, featureName)`, `requireFeature(featureName)` (uses the signed-in agency org), `FEATURE_NOT_AVAILABLE_MESSAGE`.
- `lib/org-snapshot.ts` — `fetchOrganizationSnapshot`, `getCachedOrganization` (React `cache()` per request for deduped reads).
- `lib/usage.ts` — AI monthly counter and storage bytes on `organizations`, with limit checks before increment/add.
- `lib/plan-limits.ts` — AI and storage caps per plan tier.

NextAuth `session` callback loads fresh plan, `orgFeatures`, and usage counters via `fetchOrganizationSnapshot` so `useFeature` / `usePlanLimits` stay aligned after mutations (on the next session resolution).

## Client

- `hooks/use-feature.ts` — `useFeature(name)` from session only; use for UI. Always enforce access on the server.
- `hooks/use-plan-limits.ts` — limits and current usage from session.

## Guarded entry points

| Area | Feature key |
|------|-------------|
| `actions/proposals.ts` (all exports) | `proposals` |
| `convertToClient` | `convert_to_client` |
| `app/api/scrape-mostaql/route.ts` | `scrape_mostaql` |
| `actions/services.ts`, `actions/project-services.ts` | `services_module` |
| `actions/files.ts` `createFile` / storage quota | `file_storage` |

File uploads reserve storage with `addStorageUsage` before inserting the row; failed inserts roll back the reservation. Deletes call `removeStorageUsage` after a successful DB delete.

## AI usage

Call `incrementAiUsage(organizationId)` from server-side AI actions before running the model. Monthly reset is applied in UTC when `ai_usage_reset_at` is before the first day of the current month. `resetAiUsage` exists for cron or manual resets.
