# API routes

Every `app/api/*` route: method, purpose, request shape, response shape. **Update this file whenever an API route is added or changed.**

---

## Auth (NextAuth)

### `GET /api/auth/*` and `POST /api/auth/*`

**Handler:** NextAuth.js v5 catch-all.  
**File:** `app/api/auth/[...nextauth]/route.ts` — exports `GET` and `POST` from `handlers` in `@/lib/auth`.

**Purpose:** Session and sign-in/sign-out (e.g. `GET /api/auth/session`, `POST /api/auth/signin`, `POST /api/auth/callback/credentials`). Not custom app logic; document only that auth lives here.

**Request/Response:** Defined by NextAuth; not documented in this file.

---

## Upload

### `POST /api/upload`

**File:** `app/api/upload/route.ts`

**Purpose:** Server-side file upload to ImageKit. Private key never exposed to client. Used for client logos and (later) file manager.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | Image file (e.g. for client logo). |
| scope | string | No | `client-logo` (default) → uploads to `agencyos/clients/logos/`. Other scopes → `agencyos/uploads/`. |

**Response (200):** `{ url: string, fileId?: string }` — ImageKit CDN URL (and file id if returned by SDK).

**Errors:** 400 (missing/invalid file), 503 (ImageKit not configured), 500 (upload failed).

---

## Invoices PDF (planned)

### `GET /api/invoices/[id]/pdf`

**Status:** Not implemented.

**Purpose:** Generate and stream invoice PDF (e.g. for download). Uses agency branding from `settings` table.

**Planned request:** GET with invoice `id` in path. Auth: require session.

**Planned response:** PDF stream (e.g. `Content-Type: application/pdf`). Status 404 if invoice not found.

**Update API.md when this route is added.**
