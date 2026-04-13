# UI components (`/components`)

`components/ui/*` is mostly **shadcn/ui** primitives. Below are **custom or notable** pieces and feature modules. **RTL:** many layouts rely on global `dir="rtl"` plus logical Tailwind (`ms-`, `me-`, `ps-`, `pe-`); some components use explicit `dir` or JSX order.

## App shell & navigation

| Component | Description |
|-----------|-------------|
| [`app-sidebar`](../components/app-sidebar.tsx) | Dashboard sidebar nav + user menu; works with `Sidebar` `side` prop for RTL. |
| [`site-header`](../components/site-header.tsx) | Top bar: sidebar trigger, search, user nav. |
| [`mobile-bottom-nav`](../components/mobile-bottom-nav.tsx) | Fixed bottom navigation on small screens. |
| [`nav-main`](../components/nav-main.tsx) / [`nav-secondary`](../components/nav-secondary.tsx) | Sidebar link groups. |
| [`nav-user`](../components/nav-user.tsx) | User dropdown in sidebar. |
| [`global-search`](../components/global-search.tsx) | Command palette hitting `/api/search` (debounced). |
| [`layout/search`](../components/layout/search.tsx) | Static ⌘K route jumper using `CommandDialog` + `nav` routes. |
| [`layout/header`](../components/layout/header.tsx) | Alternate/legacy header patterns. |
| [`layout/logo`](../components/layout/logo.tsx) | Branding mark. |
| [`anchor`](../components/anchor.tsx) | Link helper. |

## Dashboard & widgets

| Component | Description |
|-----------|-------------|
| [`dashboard-home`](../components/dashboard-home.tsx) | Home dashboard composition. |
| [`section-cards`](../components/section-cards.tsx) | KPI / stat cards. |
| [`chart-area-interactive`](../components/chart-area-interactive.tsx) | Interactive chart wrapper. |
| [`dashboard/assignee-avatars`](../components/dashboard/assignee-avatars.tsx) | Stacked avatars with **`dir="rtl"`** and negative overlap for correct visual order. |
| [`dashboard/assignee-picker`](../components/dashboard/assignee-picker.tsx) | User picker for task assignment. |
| [`dashboard/user-nav`](../components/dashboard/user-nav.tsx) | Header user menu. |

## Data display & tables

| Component | Description |
|-----------|-------------|
| [`data-table`](../components/data-table.tsx) | Generic data table helper. |
| [`ui/sortable-data-table`](../components/ui/sortable-data-table.tsx) | Drag-and-drop + TanStack Table + persistence (Notion-style). |
| [`ui/entity-table-shell`](../components/ui/entity-table-shell.tsx) / [`entity-table-contract`](../components/ui/entity-table-contract.ts) | Shared table/list contracts. |
| [`ui/table`](../components/ui/table.tsx) | shadcn table primitive. |

## RTL / locale-specific UI

| Component | Description |
|-----------|-------------|
| [`ui/date-picker-ar`](../components/ui/date-picker-ar.tsx) | Date picker with Arabic calendar locale **by default** (`arSA`). Optional props: **`direction`** (`"rtl"` \| `"ltr"`), **`locale`** (e.g. `enUS` from `date-fns/locale`), **`popoverAlign`** — used on **Expenses** (LTR + English) for filters and modal. |
| [`ui/sar-currency-icon`](../components/ui/sar-currency-icon.tsx) | **`SarCurrencyIcon`** — Saudi Riyal display using **Next/Image** of [`/public/Saudi_Riyal_Symbol.png`](../public/Saudi_Riyal_Symbol.png) (`title="Saudi Riyal"`). Used **globally** wherever SAR amounts are shown instead of literal “ر.س” or “SAR” text: invoices (**`AmountWithSarIcon`** in list view), expenses, dashboards, etc. Accepts optional **`className`** on the wrapper span for theming (e.g. white icon on dark cards). |
| [`ui/kbd`](../components/ui/kbd.tsx) | Keyboard hint styling (used with search shortcuts). |

## Feature modules (`components/modules/*`)

| Area | Notable files |
|------|----------------|
| **clients** | `client-form-sheet`, `client-overview`, `client-*-tab` (incl. **`client-expenses-tab`**), `clients-page-fab`, `edit-client-button`, `data-table` (via app) |
| **projects** | `projects-list-view`, `new-project-dialog`, `edit-project-dialog`, `project-*-tab` (incl. **`project-expenses-tab`**), `project-cover-banner`, `project-tasks-tab` (Kanban wiring) |
| **tasks** | `tasks-list-view`, `tasks-kanban`, `tasks-page-content`, `new-task-modal`, `task-detail-modal` |
| **invoices** | `invoices-list-view` (**CSV / XLSX** export), `new-invoice-dialog` (multi-project checkboxes), `edit-invoice-form`, `invoice-detail-header`, `invoice-detail-actions`, **`payment-history`**, **`add-payment-modal`**, **`invoice-attachments`**, `invoice-pdf-document`, `mark-as-paid-dialog` |
| **expenses** | `expenses-list-view` (LTR, filters incl. project/client, bulk delete, **CSV/XLSX** export), `new-expense-dialog`, `expense-category-badge`, **`recurring-expenses-view`**, **`new-recurring-expense-dialog`**, **`expense-attachments`**, **`expense-detail-header`** |
| **proposals** | `proposals-list-view`, `new-proposal-dialog`, `edit-proposal-dialog`, `convert-to-client-dialog`, `proposal-status-badge` |
| **team** | `team-list-view`, `new-member-modal`, `team-member-detail-tabs`, `edit-team-member-button` |
| **services** | `services-list-view`, `new-service-modal` |
| **files** | `file-manager`, `file-preview-modal` |

## Reports & charts

| Component | Description |
|-----------|-------------|
| [`reports/revenue-chart-section`](../components/reports/revenue-chart-section.tsx) | Financial reports: revenue / expenses / profit chart wrapper. |
| [`reports/monthly-comparison-chart`](../components/reports/monthly-comparison-chart.tsx) | Month-over-month comparison chart. |
| [`reports/revenue-chart`](../components/reports/revenue-chart.tsx) | Shared Recharts bar chart (invoiced / collected / expenses). |
| [`reports/profitability-visualization`](../components/reports/profitability-visualization.tsx) | **Profitability analysis** — project / client / service toggles, bar / pie / treemap, date range, **`downloadReportPdf`** for active mode. |
| [`app/dashboard/reports/reports-financial-tab`](../app/dashboard/reports/reports-financial-tab.tsx) | Client: financial tab composition (KPIs, charts, **`ProfitabilityVisualization`**, currency provider). |
| [`reports/profit-loss-section`](../components/reports/profit-loss-section.tsx) | **`getProfitLossStatement`** + period selector + **Download PDF**. |
| [`reports/cash-flow-forecast-section`](../components/reports/cash-flow-forecast-section.tsx) | **`getCashFlowForecast`** outlook (and placeholder variant). |
| [`reports/aging-report-section`](../components/reports/aging-report-section.tsx) | **AR aging** — buckets + detail table; data from **`getAgingReport`**. |
| [`reports/project-profitability-section`](../components/reports/project-profitability-section.tsx) / [`client-profitability-section`](../components/reports/client-profitability-section.tsx) | Sortable profitability tables + **PDF** export per scope. |
| [`reports/top-profitable-projects-widget`](../components/reports/top-profitable-projects-widget.tsx) | Top profitable projects highlight. |
| [`reports/reports-financial-subtabs`](../components/reports/reports-financial-subtabs.tsx) | **Profitability** subtabs (project vs client) and **financial details** subtabs (pie, recent invoices, outstanding). |
| [`reports/reports-currency-context`](../components/reports/reports-currency-context.tsx) | SAR ↔ EGP toggle state for reports. |
| [`reports/reports-money`](../components/reports/reports-money.tsx) | Formatted money + icon inside reports. |
| [`reports/reports-pdf-document`](../components/reports/reports-pdf-document.tsx) | `@react-pdf/renderer` documents for **`/api/reports/pdf`**. |
| [`reports/outstanding-invoices-table`](../components/reports/outstanding-invoices-table.tsx) | Outstanding list; mark-paid workflow. |
| [`reports/productivity-reports-tab`](../components/reports/productivity-reports-tab.tsx) | Projects & productivity tab (KPIs, charts, team salary breakdown). |
| [`modules/reports/top-clients-pie-chart`](../components/modules/reports/top-clients-pie-chart.tsx) | Pie chart widget (used inside report subtabs). |
| [`modules/invoices/payment-history`](../components/modules/invoices/payment-history.tsx) | Invoice detail: payment list, progress bar, record/delete payment. |
| [`modules/invoices/add-payment-modal`](../components/modules/invoices/add-payment-modal.tsx) | Modal to record a partial or full payment (amount, date, method, reference, notes). |
| [`modules/invoices/invoice-attachments`](../components/modules/invoices/invoice-attachments.tsx) | Invoice detail: upload/list/download/delete (`createFile` + `invoiceId`; PDF preview). |

## Other

| Component | Description |
|-----------|-------------|
| [`theme-selector`](../components/theme-selector.tsx) / [`theme-toggle`](../components/theme-toggle.tsx) | Theme switching (note: sidebar stays dark in CSS vars). |
| [`providers`](../components/providers.tsx) | Root client providers. |
| [`providers/session-provider`](../components/providers/session-provider.tsx) | NextAuth session. |
| [`ui/avatar-stack`](../components/ui/avatar-stack.tsx) | Overlapping avatars for project cards (mind RTL overlap). |
| [`ui/sonner`](../components/ui/sonner.tsx) | Toaster styling. |

## shadcn overrides worth knowing

- **`globals.css`** — Sidebar tokens set to **black `#000000`** and zinc accents so the rail stays dark regardless of light/dark theme toggle.
- **Sidebar** — `AppSidebar` receives `side={sidebarSide}` from dashboard layout (`ar` → `right`).

## Current state addendum

<!-- ADDED 2026-03-23 -->

- `DatePickerAr` now auto-detects locale/direction via `next-intl` `useLocale()` when props are not provided (English/LTR in `en`, Arabic/RTL in `ar`).  
  <!-- OUTDATED: earlier note said Arabic locale by default -->
- Workspace module now includes `workspace-calendar-view.tsx` and calendar route integration.
- `components/modules/tasks/new-task-modal.tsx` now supports:
  - start date + end date
  - assignee selection at creation time (when team members are provided)
