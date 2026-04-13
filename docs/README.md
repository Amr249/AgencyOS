# AgencyOS — documentation index

Living documentation for the **AgencyOS** Next.js dashboard. Keep these files updated as the codebase changes.

## Core (this pass)

| Document | Purpose |
|----------|---------|
| [project-overview.md](./project-overview.md) | Product name, purpose, solo/RTL-first scope, tech stack, deployment, design principles. |
| [architecture.md](./architecture.md) | Current repository layout: `app`, `components`, `actions`, `lib`, `drizzle`, etc. |
| [database-schema.md](./database-schema.md) | Drizzle/PostgreSQL tables, enums, relationships (from `lib/db/schema.ts`). |
| [server-actions.md](./server-actions.md) | Each file in `/actions`: exports, parameters, return shapes, `db-errors` usage. |
| [ui-components.md](./ui-components.md) | Custom and feature components; RTL-related notes; shadcn overrides. |
| [rtl-conventions.md](./rtl-conventions.md) | How RTL is applied (`dir`, sidebar side, logical CSS, gotchas). |
| [error-handling.md](./error-handling.md) | `db-errors.ts`, i18n keys, which actions use the pattern, gaps. |
| [changelog.md](./changelog.md) | Short-form **[Unreleased]** / **[Recent]** notes. |
| [CHANGELOG-archive.md](./CHANGELOG-archive.md) | Detailed append-only history (2026-03-05 — 2026-03-08) preserved when the living changelog format was introduced. |

## Legacy / deep-dive docs (still valid)

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE-legacy.md](./ARCHITECTURE-legacy.md) | Older architecture narrative (some sections outdated — e.g. Cairo font vs IBM Plex). See [architecture.md](./architecture.md) for current layout. |
| [DATABASE.md](./DATABASE.md) | Narrative database documentation. |
| [MODULES.md](./MODULES.md) | Feature module behavior (clients, projects, …). |
| [API.md](./API.md) | HTTP API routes under `app/api`. |
| [DECISIONS.md](./DECISIONS.md) | Technical decision log. |
| [TODO.md](./TODO.md) | Build status / backlog. |
| [types/index.md](./types/index.md) | Display maps in `types/index.ts` (invoice, payment, recurrence labels, etc.). |

## Setup & environment

- Copy [`.env.example`](../.env.example) to `.env.local` and set `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and auth-related variables.
- Scripts: `pnpm dev`, `pnpm build`, `pnpm db:generate` / `db:push` / `db:migrate` — see [`package.json`](../package.json).

## Quick links

- Application entry: [`app/layout.tsx`](../app/layout.tsx)
- Drizzle schema: [`lib/db/schema.ts`](../lib/db/schema.ts)
- DB client: [`lib/db/index.ts`](../lib/db/index.ts)
- Environment template: [`.env.example`](../.env.example)
