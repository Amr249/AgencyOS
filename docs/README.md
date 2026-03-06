# AgencyOS

**Solo operations dashboard for a web design agency.** Replace Notion: manage clients, projects, tasks, invoices, and files from one screen. Single-user (no team, no RBAC). PRD v2.0 Solo Edition.

---

## What AgencyOS is

- **Purpose:** Personal ops dashboard — one place for clients, projects, tasks, invoices, and file storage.
- **Users:** Single admin (you). No registration, no invites, no email sending in v1.
- **Auth:** One account via NextAuth credentials; email + bcrypt hash in env vars. No users table.

---

## Tech stack

| Layer        | Choice |
|-------------|--------|
| Framework   | Next.js 14+ (App Router), TypeScript |
| UI         | shadcn/ui + Tailwind CSS (bundui base) |
| Database   | Neon (PostgreSQL), pooled connection |
| ORM        | Drizzle ORM, drizzle-kit migrations |
| Auth       | NextAuth.js v5 — Credentials provider, JWT session |
| File storage | ImageKit (server-side upload only) |
| Forms      | React Hook Form + Zod |
| Hosting    | Vercel (edge-compatible) |

---

## Run locally

1. **Clone and install**
   ```bash
   pnpm install
   # or: npm install   (project has .npmrc with legacy-peer-deps for React 19 / lucide-react)
   ```

2. **Environment**
   - Copy `.env.example` to `.env.local`.
   - Set `DATABASE_URL` (Neon pooled), `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH` (see below).

3. **Database**
   ```bash
   pnpm db:generate   # generate migrations (when schema changes)
   pnpm db:push       # apply schema to Neon
   # or: pnpm db:migrate
   ```

4. **Dev server**
   ```bash
   pnpm dev
   ```
   Open [http://localhost:3000](http://localhost:3000). Sign in at `/login`.

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Neon **pooled** connection string (serverless/edge). |
| `AUTH_SECRET` | Yes | NextAuth secret (e.g. `npx auth secret` or `openssl rand -base64 32`). |
| `NEXTAUTH_URL` | Yes | App URL (e.g. `http://localhost:3000`). |
| `ADMIN_EMAIL` | Yes | Single admin login email. |
| `ADMIN_PASSWORD_HASH` | Yes | bcrypt hash of admin password. Generate: `node -e "console.log(require('bcryptjs').hashSync('YOUR_PASSWORD', 10))"` |
| `DATABASE_URL_DIRECT` | No | Optional direct (non-pooler) URL for migrations. |
| `IMAGEKIT_PUBLIC_KEY` | No | For File Manager (Phase 3). |
| `IMAGEKIT_PRIVATE_KEY` | No | For File Manager (Phase 3). Never expose client-side. |
| `IMAGEKIT_URL_ENDPOINT` | No | e.g. `https://ik.imagekit.io/yourname`. |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL. |
| `NEXT_PUBLIC_APP_NAME` | No | App name (default AgencyOS). |

---

## Docs index

- [ARCHITECTURE.md](./ARCHITECTURE.md) — App structure, Server Actions, auth, ImageKit.
- [DATABASE.md](./DATABASE.md) — Tables, fields, relationships.
- [MODULES.md](./MODULES.md) — Clients, Projects, Tasks, Invoices, Files, Dashboard, Reports, Settings.
- [API.md](./API.md) — API routes (`/api/*`).
- [DECISIONS.md](./DECISIONS.md) — Technical decisions log.
- [CHANGELOG.md](./CHANGELOG.md) — What was built, in order.
- [TODO.md](./TODO.md) — Built vs in progress vs not started.
