# Project overview

## Name

**AgencyOS** — internal product name used in metadata (`app/layout.tsx`: title template `%s | AgencyOS`).

The npm `package.json` name is still `shadcn-ui-kit-free` (template artifact); consider aligning it with AgencyOS in a future housekeeping pass.

## Purpose

Internal operations dashboard for a **Saudi web design agency** (OnePixle): clients, projects, tasks, invoices, expenses, proposals, team, files, and reports in one place.

## Audience & language

- **Solo-operated** — designed as a single-user / small-team tool; schema includes `users` for NextAuth and optional task assignments.
- **Arabic RTL-first** — default locale is Arabic (`ar`); English available via locale cookie. UI copy and validation messages are largely Arabic.

## Tech stack (verified from `package.json`)

| Area | Technology |
|------|------------|
| Framework | **Next.js 16** (App Router), React 19, TypeScript — *briefs may say “14”; `package.json` is authoritative.* |
| UI | **shadcn/ui** (Radix), **Tailwind CSS 4** |
| i18n | **next-intl** (`messages/ar.json`, `messages/en.json`) |
| Database | **Neon** PostgreSQL (`@neondatabase/serverless`, pooled `DATABASE_URL` in `.env.example`) |
| ORM | **Drizzle ORM** + **drizzle-kit** (`db:generate`, `db:migrate`, `db:push`, `db:studio`) |
| Auth | **NextAuth v4** (credentials, `lib/auth.ts`) |
| File CDN | **ImageKit** (optional; uploads via `app/api/upload/route.ts`) |

## Deployment

**Target: Vercel** (or any Node host). `.env.example` documents `NEXTAUTH_URL` and Neon pooled connection string — typical for Vercel + Neon. No platform-specific config is required beyond environment variables.

<!-- TODO: Add production URL and Vercel project name when finalized. -->

## Design principles

1. **RTL-first** — `<html dir>` and `<body dir>` follow locale; dashboard sidebar uses `side="right"` for Arabic (`app/dashboard/layout.tsx`).
2. **Arabic user-facing errors** — DB connectivity uses keyed errors (`errors.connectionTimeout`, etc.) in Arabic/English message files; some actions still return raw Arabic strings (see [error-handling.md](./error-handling.md)).
3. **Clean dashboard aesthetics** — dark sidebar tokens, restrained cards, IBM Plex Sans / IBM Plex Sans Arabic fonts in root layout.
