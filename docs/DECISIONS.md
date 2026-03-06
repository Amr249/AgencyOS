# Technical decisions

Running log of meaningful technical decisions and why. **Append-only: add new entries when a non-obvious decision is made; do not delete or edit past entries.**

---

- **Drizzle over Prisma** — Edge/serverless compatible with Neon; lighter; schema and migrations in code. PRD specified Drizzle.

- **Neon pooled connection for app** — Serverless/edge requires connection pooling; use pooled `DATABASE_URL` for runtime. Optional direct URL for migrations only.

- **Single admin auth via env (no users table)** — Solo dashboard; one user. Avoids DB round-trip for auth and keeps v1 scope small. NextAuth Credentials + bcrypt hash in `ADMIN_EMAIL` / `ADMIN_PASSWORD_HASH`.

- **NextAuth v5 (beta) with JWT session** — No DB session store needed for single user. JWT strategy; 30-day max age.

- **Server Actions for all mutations** — No REST CRUD for app logic; use Server Actions only. Keeps one pattern and avoids duplicate validation.

- **Zod validation inside every Server Action** — Validate all inputs on the server before DB or side effects; return typed errors for forms.

- **Soft-delete with `deleted_at`** — Clients (and other entities where specified) use `deleted_at` instead of hard delete for recoverability and referential integrity.

- **ImageKit only for file storage** — No local file storage; all files via ImageKit. Upload must be server-side (API route) so private key is never exposed.

- **shadcn/ui + Tailwind, extend bundui template** — PRD base template; avoid introducing another UI library.

- **No email sending in v1** — Out of scope; no Resend or other email in initial scope. Invoice “Sent” is manual.

- **No users table, no RBAC, no team or proposals in v1** — Solo edition; strip multi-user, roles, invites, activity log, proposals. Single source of truth: PRD v2 Solo.

- **Client contact fields: contact_name, contact_email, contact_phone** — PRD v2 schema uses these names (not primary_contact_* / phone) for consistency with schema and forms.

- **.npmrc legacy-peer-deps=true** — lucide-react@0.379 declares peer react ^16|^17|^18 only; project uses React 19. Enabling legacy-peer-deps in .npmrc lets `npm install` succeed without requiring the flag every time.

- **Client form: no address, phone required, optional logo** — Location not needed for new clients; phone is required, email optional. Logo upload via ImageKit (server-side POST /api/upload) stores URL in clients.logoUrl.
