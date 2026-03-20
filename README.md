# AgencyOS — لوحة تحكم العمليات

Internal operations dashboard for a **solo-run Saudi web design agency**: clients, projects, tasks, invoices, expenses, proposals, team, and files in one place. The UI is **Arabic RTL-first** (English optional), built on **Next.js 16** (App Router), **TypeScript**, **shadcn/ui**, **Neon PostgreSQL**, and **Drizzle ORM**. Deployed on **Vercel**.

---

## Quick Start

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.example` to `.env.local` and set at least:

   | Variable | Purpose |
   |----------|---------|
   | `DATABASE_URL` | Neon pooled PostgreSQL connection string (required for Drizzle) |
   | `NEXTAUTH_SECRET` | Secret for NextAuth sessions — generate e.g. `openssl rand -base64 32` |
   | `NEXTAUTH_URL` | App URL (e.g. `http://localhost:3000` locally; production URL on Vercel) |

   Optional: `DATABASE_URL_DIRECT` (non-pooler URL for migrations), ImageKit keys for file uploads (`IMAGEKIT_*`), `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_APP_NAME`.

3. **Database schema**

   Apply the Drizzle schema to Neon (development-friendly):

   ```bash
   npm run db:push
   ```

   For migration SQL workflows, use `npm run db:generate` then `npm run db:migrate` instead.

4. **Run the app**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000). Sign in at `/login`.

---

## Documentation

Project documentation lives in **`/docs`**. Treat it as the source of truth as the codebase changes.

| File | Contents |
|------|----------|
| [docs/project-overview.md](docs/project-overview.md) | Stack, goals, design principles |
| [docs/architecture.md](docs/architecture.md) | Folder structure and module roles |
| [docs/database-schema.md](docs/database-schema.md) | Full Drizzle schema reference |
| [docs/server-actions.md](docs/server-actions.md) | All server actions, inputs, error handling |
| [docs/ui-components.md](docs/ui-components.md) | Component inventory and RTL notes |
| [docs/rtl-conventions.md](docs/rtl-conventions.md) | RTL patterns and known gotchas |
| [docs/error-handling.md](docs/error-handling.md) | DB error strategy and coverage table |
| [docs/changelog.md](docs/changelog.md) | Living changelog |
| [docs/CHANGELOG-archive.md](docs/CHANGELOG-archive.md) | Full history archive |
| [docs/MODULES.md](docs/MODULES.md) | Per-module behavior (clients, projects, expenses, …) — **update when changing features** |

More: [docs/README.md](docs/README.md) (index of all docs, including legacy deep-dives).

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Database | Neon PostgreSQL |
| ORM | Drizzle |
| Auth | NextAuth.js v4 (credentials, JWT; DB-backed users) |
| i18n | next-intl (Arabic + English) |
| Deployment | Vercel |
