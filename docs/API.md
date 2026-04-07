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

**Purpose:** Server-side upload to **ImageKit**. Private key stays on the server.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | Yes | Any allowed file (images, PDFs, etc.). |
| `folder` | string | No | If set, used as ImageKit folder path (normalized, no leading slash). Takes precedence over `scope` routing. |
| `scope` | string | No | Default `client-logo`. Determines folder when **`folder` is omitted**: `agency-logo`, `client-logo`, `project-cover` (optional `projectId`), `team-avatar`, **`invoice-attachment`** (requires valid **`invoiceId`** → `agencyos/invoices/{invoiceId}`), or fallback `agencyos/uploads`. |
| `invoiceId` | string (UUID) | When using `invoice-attachment` without `folder` | Required for `invoice-attachment` scope to resolve folder. |
| `projectId` | string | For `project-cover` | Used to build project cover path when applicable. |

**Response (200):** `{ url, fileId?, name, size, mimeType, filePath }`.

**Errors:** 400 (missing/invalid file), 503 (ImageKit not configured), 500 (upload failed).

---

## Invoices PDF

### `GET /api/invoices/[id]/pdf`

**File:** `app/api/invoices/[id]/pdf/route.ts`

**Purpose:** Stream a branded invoice PDF (English).

**Implementation:** Uses **`getInvoiceWithPayments`** (invoice, client, items, **payments**, **linkedProjects**, totals) and **`getSettings`**. Renders `InvoicePdfDocument` via `@react-pdf/renderer`.

**Response:** `200` — `Content-Type: application/pdf`; attachment filename `invoice-{number}.pdf` (UTF-8 filename*). **`404`** if invoice missing.

---

## Current API snapshot

<!-- ADDED 2026-03-23 -->

### Auth

- `GET|POST /api/auth/[...nextauth]`
- File: `app/api/auth/[...nextauth]/route.ts`
- Uses `NextAuth(authOptions)` with exports `{ handler as GET, handler as POST }`.
- Backed by `next-auth` v4 in `package.json`.

### Upload

- `POST /api/upload` — see [Upload](#upload) above for **`invoice-attachment`** + **`invoiceId`**, and explicit **`folder`** (e.g. invoice attachments from the client often send `folder=agencyos/invoices/{uuid}` plus `scope`/`invoiceId` for consistency).

### Search

- `GET /api/search?q=...`
- File: `app/api/search/route.ts`
- Returns grouped quick results:
  - `clients[]`
  - `projects[]`
  - `invoices[]`
  - `tasks[]`
- Requires query length >= 2; otherwise returns empty arrays.

### Locale

- `POST /api/set-locale`
- File: `app/api/set-locale/route.ts`
- Body: `{ "locale": "ar" | "en" }`
- Sets `locale` cookie for one year.

### Scraping helper

- `GET /api/scrape-mostaql?url=...`
- File: `app/api/scrape-mostaql/route.ts`
- Scrapes and returns proposal seed data:
  - `title`
  - `budgetMin`
  - `budgetMax`
  - `category`
  - `description`

### Invoice PDF

- `GET /api/invoices/[id]/pdf` — see [Invoices PDF](#invoices-pdf) above (`getInvoiceWithPayments`, not `getInvoiceById`).
