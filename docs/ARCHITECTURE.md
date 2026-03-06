# Architecture

How the AgencyOS app is structured: App Router, folders, Server Actions, auth, and ImageKit.

---

## Arabic RTL and typography

- **Language & direction:** The app is **Arabic RTL**. In `app/layout.tsx`, the root `<html>` has `lang="ar"` and `dir="rtl"`; the root `<body>` also has `dir="rtl"`.
- **Font:** **Cairo** from Google Fonts (`next/font/google`) is applied as the default font for the entire app. Cairo supports both Arabic and Latin, so mixed content (e.g. numbers, English terms) renders well.
- **Layout:** Sidebar is on the **right** for RTL (`side="right"` on `AppSidebar`). Text alignment is `text-right` by default (globals.css). Directional icons (e.g. sidebar trigger, breadcrumb separator) are mirrored via CSS in `[dir="rtl"]`. Tables and forms use logical spacing (`ms-`, `me-`, `pe-`, `ps-`) where direction matters.
- **Numbers and dates:** Numbers use Western Arabic numerals (0–9). Dates are formatted as **DD/MM/YYYY**. Currency (e.g. SAR) is shown as **amount + space + ر.س** (e.g. `1,000 ر.س`).

---

## App Router layout

- **Root** — `app/layout.tsx` wraps the app with `Providers` (SessionProvider + ThemeProvider). No auth check here.
- **(guest)** — `app/(guest)/layout.tsx` is a pass-through. Used for public routes: `login`, `404-page`, `500-page`.
- **(dashboard)** — All dashboard routes live under `app/dashboard/`. `app/dashboard/layout.tsx`:
  - Calls `auth()` from `@/lib/auth`.
  - If no session, redirects to `/login?callbackUrl=/dashboard`.
  - Renders sidebar (`AppSidebar`), header (`SiteHeader`), and children in a `SidebarProvider` shell.

**Route groups:** `(guest)` and `(dashboard)` are Next.js route groups (parentheses = no segment in URL). So `/login` is `(guest)/login`, `/dashboard` is `dashboard/page.tsx`.

---

## Folder structure

```
├── app/
│   ├── layout.tsx                 # Root: Providers wrap children
│   ├── (guest)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx         # Credentials login form
│   │   ├── 404-page/page.tsx
│   │   └── 500-page/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx            # Auth check, sidebar + header
│   │   ├── page.tsx              # Dashboard home
│   │   ├── clients/              # List + [id] detail
│   │   ├── projects/             # Placeholder
│   │   ├── tasks/                # Placeholder
│   │   ├── invoices/             # Placeholder
│   │   ├── reports/              # Placeholder
│   │   └── settings/             # Settings pages
│   └── api/
│       └── auth/[...nextauth]/route.ts   # NextAuth handlers
├── actions/                      # Server Actions (one file per domain)
│   └── clients.ts
├── components/
│   ├── ui/                       # shadcn components
│   ├── layout/                   # Sidebar, header, nav
│   ├── app-sidebar.tsx           # Main nav (Dashboard, Clients, …)
│   ├── nav-user.tsx              # User menu + sign out
│   ├── providers.tsx             # SessionProvider + ThemeProvider
│   └── modules/                  # Feature-specific components
│       └── clients/              # ClientFormSheet, ClientOverview, EditClientButton
├── lib/
│   ├── db/
│   │   ├── index.ts              # Drizzle client (Neon serverless)
│   │   └── schema.ts             # All tables + relations
│   └── auth.ts                   # NextAuth config (credentials, JWT)
└── types/
    ├── index.ts                  # CLIENT_STATUS_LABELS, AddressJson re-export
    └── next-auth.d.ts            # Session user id extension
```

- **No `src/`** — App lives at project root (`app/`, `components/`, `lib/`, `actions/`).
- **`@/`** — TypeScript path alias for project root (e.g. `@/lib/db`, `@/actions/clients`).

---

## Server Actions

- **Location:** `actions/*.ts`. One file per domain (e.g. `clients.ts`).
- **Convention:** Every mutation is a Server Action. No REST CRUD endpoints for app logic.
- **Pattern:**
  - Each action is `async` and marked with `"use server"` at the top of the file (or on the function).
  - Input is validated with **Zod** before any DB or side effect.
  - Return shape: `{ ok: true, data }` or `{ ok: false, error: string | Record<...> }`.
  - After a successful mutation, call `revalidatePath(...)` so the UI reflects changes.
- **Usage:** Called from Client Components (e.g. form submit, button click) or from Server Components. No `fetch` to internal API for CRUD.

---

## Auth

- **Provider:** NextAuth.js v5, **Credentials** only. Config in `lib/auth.ts`.
- **Credentials:** Single admin. `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` (bcrypt) in env. No users table.
- **Flow:** User submits email + password on `/login` → `signIn("credentials", { email, password, callbackUrl })` → NextAuth calls `authorize()` in `lib/auth.ts` → compares email to `ADMIN_EMAIL` and password with `bcrypt.compare()` → on success returns user `{ id: "admin", email, name }` and issues JWT.
- **Session:** JWT strategy, 30-day max age. Session includes `user.id`, `user.email`, `user.name` (see `types/next-auth.d.ts`).
- **Protection:** `app/dashboard/layout.tsx` runs `await auth()`; if no session, `redirect("/login?callbackUrl=/dashboard")`. All routes under `dashboard/*` are therefore protected.
- **Client:** `SessionProvider` in `components/providers.tsx` wraps the app so client components can use `useSession()`, `signIn()`, `signOut()`.

---

## ImageKit uploads (planned)

- **Scope:** File Manager (Phase 3). All uploads go through ImageKit; nothing stored on app server.
- **Security:** Private key must never be exposed to the client. Upload will be implemented as a **server-only API route**: `POST /api/upload`.
- **Flow (planned):** Client sends file (e.g. multipart) to `/api/upload` with scope (e.g. `clientId` or `projectId`). Server uses ImageKit SDK to upload to `/agencyos/clients/{id}/` or `/agencyos/projects/{id}/`, then inserts a row in `files` with `imagekit_file_id`, `imagekit_url`, `file_path`, etc.
- **Config:** `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` in env. No ImageKit route exists in the codebase yet; this doc will be updated when `/api/upload` is added.
