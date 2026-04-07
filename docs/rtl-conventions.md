# RTL conventions

## How RTL is enforced

1. **Document direction** — [`app/layout.tsx`](../app/layout.tsx) sets `lang` from next-intl locale and:
   - `<html dir={isRTL ? "rtl" : "ltr"}>`
   - `<body dir={isRTL ? "rtl" : "ltr"}>`  
   Default locale is Arabic (`ar`) unless the `locale` cookie is `en` ([`lib/locale.ts`](../lib/locale.ts), [`app/api/set-locale/route.ts`](../app/api/set-locale/route.ts)).

2. **Sidebar placement** — [`app/dashboard/layout.tsx`](../app/dashboard/layout.tsx) sets:
   - `const sidebarSide = locale === "ar" ? "right" : "left"`
   - `<AppSidebar side={sidebarSide} />`  
   So the main navigation rail sits on the **right** in Arabic, matching RTL expectations.

3. **Logical CSS** — Prefer **`ms-` / `me-` / `ps-` / `pe-`** (margin/padding inline start/end) over `ml`/`mr` where mirroring matters. Example: [`components/layout/search.tsx`](../components/layout/search.tsx) uses `me-2` on command icons.

4. **Explicit `dir` in subtrees** — Some components set `dir="rtl"` locally when the visual order must not depend on inheritance alone (e.g. stacked avatars). Conversely, **`ExpensesListView`** (`app/dashboard/expenses`) sets **`dir="ltr"`** on the page and table wrapper so the expenses UI stays left-to-right and English even when the shell is RTL (Arabic locale).

5. **Explicit JSX order** — For overlapping elements (avatars, badges), **order children in JSX** so the correct item appears on top / leading edge in RTL; do not rely on CSS `left`/`right` alone without testing.

## Fonts

- Root layout uses **IBM Plex Sans Arabic** when `locale === "ar"`, else IBM Plex Sans + Arabic variable for mixed content ([`app/layout.tsx`](../app/layout.tsx)).
- `globals.css` still references Geist font tokens in `@theme` — **legacy**; live layout uses IBM Plex from `next/font`. <!-- TODO: align @theme font-sans with IBM Plex if you want CSS variables to match. -->

## Tailwind / global config

- **Tailwind v4** — [`app/globals.css`](../app/globals.css) uses `@import "tailwindcss"`, `@theme inline`, and sidebar/chart CSS variables.
- No separate `tailwind.config.js` in repo root (v4 inline theme). RTL does **not** use a `rtl:` plugin; direction comes from `dir` on `html`/`body`.

## Known gotchas

| Area | Issue | Mitigation |
|------|--------|------------|
| **Avatar stacks** | Overlap direction (`marginLeft` / negative margins) can flip incorrectly in RTL. | [`components/dashboard/assignee-avatars.tsx`](../components/dashboard/assignee-avatars.tsx) wraps in `dir="rtl"` and uses overlap; verify when changing. |
| **Stacked UI avatars** | Same class of issues for `AvatarStack` in project cards. | Test gallery/table views in Arabic. |
| **Keyboard hints** | ⌘K vs Ctrl+K is OS-dependent; shortcuts are global. | [`components/layout/search.tsx`](../components/layout/search.tsx) listens for `metaKey || ctrlKey`. |
| **Charts** | Recharts tooltips/legends need Arabic labels from data layer ([`actions/reports.ts`](../actions/reports.ts) uses `date-fns/locale` where applicable). | — |
| **Numbers** | Product historically uses **Western numerals (0–9)** in UI for amounts. | Keep consistent with finance tables. |

## next-intl

- Messages in [`messages/ar.json`](../messages/ar.json) and [`messages/en.json`](../messages/en.json).
- Error strings for DB keys live under **`errors.*`** (see [error-handling.md](./error-handling.md)).

## Current state addendum

<!-- ADDED 2026-03-23 -->

- Workspace pages currently enforce English/LTR wrappers (`dir="ltr" lang="en"`) for:
  - `/dashboard/workspace`
  - `/dashboard/workspace/board`
  - `/dashboard/workspace/calendar`
  - `/dashboard/workspace/timeline`
  - `/dashboard/workspace/workload`
- Workspace module components also render LTR-oriented layouts by design.
- Expenses remains the original documented LTR exception.
