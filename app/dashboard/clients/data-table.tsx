"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  Archive,
  ArchiveRestore,
  ArrowUpDown,
  Check,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClientFormSheet } from "@/components/modules/clients/client-form-sheet";
import {
  archiveClient,
  unarchiveClient,
  deleteClient,
  deleteClients,
  updateClient,
} from "@/actions/clients";
import { toast } from "sonner";
import type { clients } from "@/lib/db/schema";
import { useTranslateActionError } from "@/hooks/use-translate-action-error";
import { isDbErrorKey } from "@/lib/i18n-errors";
import { listSavedViews, removeSavedView, upsertSavedView } from "@/lib/table-views";

type ClientRow = typeof clients.$inferSelect & { projectCount: number };

type ClientsDataTableProps = {
  activeClients: ClientRow[];
  archivedClients: ClientRow[];
  selectedTab?: string;
  serviceOptions: { id: string; name: string; status: string }[];
  clientServiceMap: Record<string, { id: string; name: string; status: string }[]>;
};

function ClientAvatar({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [logoFailed, setLogoFailed] = React.useState(false);
  React.useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-purple-100 text-purple-700",
    "bg-amber-100 text-amber-700",
    "bg-green-100 text-green-700",
    "bg-red-100 text-red-700",
    "bg-pink-100 text-pink-700",
  ];
  const index = (name.charCodeAt(0) || 0) % colors.length;
  const showLogo = logoUrl && !logoFailed;

  if (showLogo) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 flex-shrink-0 rounded-lg object-cover"
        onError={() => setLogoFailed(true)}
      />
    );
  }

  return (
    <div
      className={`h-8 w-8 flex-shrink-0 rounded-lg text-xs font-medium flex items-center justify-center ${colors[index]}`}
    >
      {name[0] ?? "?"}
    </div>
  );
}

function StatusPill({ status }: { status: ClientRow["status"] }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {tc("active")}
      </span>
    );
  }
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {tc("completed")}
      </span>
    );
  }
  if (status === "lead") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {t("statusLead")}
      </span>
    );
  }
  if (status === "on_hold") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {t("statusOnHold")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t("statusClosed")}
    </span>
  );
}

const CLIENT_STATUSES: ClientRow["status"][] = [
  "lead",
  "active",
  "on_hold",
  "completed",
  "closed",
];

function ClientStatusCell({ client }: { client: ClientRow }) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const router = useRouter();
  const translateErr = useTranslateActionError();
  const [pending, setPending] = React.useState(false);

  function labelFor(status: ClientRow["status"]): string {
    if (status === "active") return tc("active");
    if (status === "completed") return tc("completed");
    const labels: Record<string, string> = {
      lead: t("statusLead"),
      on_hold: t("statusOnHold"),
      closed: t("statusClosed"),
    };
    return labels[status] ?? status;
  }
  function dotClassFor(status: ClientRow["status"]): string {
    if (status === "active") return "bg-green-500";
    if (status === "completed") return "bg-neutral-400";
    if (status === "lead") return "bg-blue-500";
    if (status === "on_hold") return "bg-amber-500";
    return "bg-red-500";
  }

  async function apply(next: ClientRow["status"]) {
    if (next === client.status || pending) return;
    setPending(true);
    try {
      const res = await updateClient({ id: client.id, status: next });
      if (!res.ok) {
        const e = res.error as Record<string, string[] | undefined>;
        const msg = e._form?.[0] ?? Object.values(e).flat()[0] ?? tc("error");
        toast.error(translateErr(msg));
        return;
      }
      toast.success(t("toastUpdated"));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={pending}>
        <button
          type="button"
          className="inline-flex max-w-full cursor-pointer rounded-full border-0 bg-transparent p-0 outline-none ring-offset-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:cursor-wait disabled:opacity-60"
          aria-label={t("changeStatusAria")}
          onClick={(e) => e.stopPropagation()}
        >
          <StatusPill status={client.status} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40" onClick={(e) => e.stopPropagation()}>
        {CLIENT_STATUSES.map((s) => (
          <DropdownMenuItem
            key={s}
            disabled={s === client.status || pending}
            onSelect={() => void apply(s)}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${dotClassFor(s)}`} aria-hidden />
                {labelFor(s)}
              </span>
              {s === client.status ? <Check className="h-4 w-4 shrink-0 opacity-60" aria-hidden /> : null}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ClientsDataTable({
  activeClients,
  archivedClients,
  selectedTab = "all",
  serviceOptions,
  clientServiceMap,
}: ClientsDataTableProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const translateErr = useTranslateActionError();

  const [editingClient, setEditingClient] = React.useState<ClientRow | null>(null);
  const [clientToDelete, setClientToDelete] = React.useState<ClientRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const headerCheckboxRef = React.useRef<HTMLInputElement>(null);
  const [search, setSearch] = React.useState("");
  const [sortBy, setSortBy] = React.useState<
    | "newest"
    | "oldest"
    | "name"
    | "contact_asc"
    | "contact_desc"
    | "projects_asc"
    | "projects_desc"
    | "status_asc"
    | "status_desc"
  >("newest");
  const [statusFilters, setStatusFilters] = React.useState<ClientRow["status"][]>([]);
  const [savedViews, setSavedViews] = React.useState(() => listSavedViews("clients-table"));
  const [selectedViewId, setSelectedViewId] = React.useState("none");

  const sortLocale = locale === "ar" ? "ar" : "en";
  const dateLocale = locale === "ar" ? "ar-SA" : "en-US";
  const statusFilterSet = React.useMemo(() => new Set(statusFilters), [statusFilters]);
  const statusRank: Record<ClientRow["status"], number> = {
    lead: 1,
    active: 2,
    on_hold: 3,
    completed: 4,
    closed: 5,
  };

  const allClients = React.useMemo(
    () => [...activeClients, ...archivedClients],
    [activeClients, archivedClients]
  );
  const baseClients =
    selectedTab === "archived"
      ? archivedClients
      : selectedTab === "active"
        ? allClients.filter((c) => c.status === "active")
        : allClients;

  const visibleClients = React.useMemo(() => {
    let rows = [...baseClients];
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      rows = rows.filter((c) => {
        const company = (c.companyName ?? "").toLowerCase();
        const contact = (c.contactName ?? "").toLowerCase();
        const phone = (c.contactPhone ?? "").toLowerCase();
        return company.includes(q) || contact.includes(q) || phone.includes(q);
      });
    }
    if (statusFilterSet.size > 0) {
      rows = rows.filter((c) => statusFilterSet.has(c.status));
    }
    rows.sort((a, b) => {
      if (sortBy === "name") return (a.companyName ?? "").localeCompare(b.companyName ?? "", sortLocale);
      if (sortBy === "contact_asc")
        return (a.contactName ?? "").localeCompare(b.contactName ?? "", sortLocale);
      if (sortBy === "contact_desc")
        return (b.contactName ?? "").localeCompare(a.contactName ?? "", sortLocale);
      if (sortBy === "projects_asc") return a.projectCount - b.projectCount;
      if (sortBy === "projects_desc") return b.projectCount - a.projectCount;
      if (sortBy === "status_asc") return statusRank[a.status] - statusRank[b.status];
      if (sortBy === "status_desc") return statusRank[b.status] - statusRank[a.status];
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortBy === "oldest" ? aTime - bTime : bTime - aTime;
    });
    return rows;
  }, [baseClients, search, sortBy, sortLocale, statusFilterSet, statusRank]);

  const visibleIdKey = visibleClients.map((c) => c.id).join("\0");
  React.useEffect(() => {
    const visibleSet = new Set(visibleClients.map((c) => c.id));
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visibleSet.has(id)));
      if (next.size === prev.size && [...prev].every((id) => next.has(id))) return prev;
      return next;
    });
  }, [visibleIdKey]);

  const selectedInView = visibleClients.filter((c) => selectedIds.has(c.id)).length;
  const allVisibleSelected =
    visibleClients.length > 0 && selectedInView === visibleClients.length;

  React.useEffect(() => {
    const el = headerCheckboxRef.current;
    if (!el) return;
    el.indeterminate = selectedInView > 0 && !allVisibleSelected;
  }, [selectedInView, allVisibleSelected, visibleClients.length]);

  const toggleSelectAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleClients.forEach((c) => next.delete(c.id));
      } else {
        visibleClients.forEach((c) => next.add(c.id));
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tableDir = locale === "ar" ? "rtl" : "ltr";
  const activeFilterCount = statusFilters.length;
  const statusLabel = (status: ClientRow["status"]) => {
    if (status === "active") return tc("active");
    if (status === "completed") return tc("completed");
    if (status === "lead") return t("statusLead");
    if (status === "on_hold") return t("statusOnHold");
    return t("statusClosed");
  };
  const statusDotClass = (status: ClientRow["status"]) => {
    if (status === "active") return "bg-green-500";
    if (status === "completed") return "bg-neutral-400";
    if (status === "lead") return "bg-blue-500";
    if (status === "on_hold") return "bg-amber-500";
    return "bg-red-500";
  };
  const toggleStatusFilter = (status: ClientRow["status"]) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };
  const saveCurrentView = () => {
    const id = crypto.randomUUID();
    const next = upsertSavedView("clients-table", {
      id,
      name: `View ${savedViews.length + 1}`,
      filters: { search, sortBy, statuses: statusFilters.join(","), tab: selectedTab },
      createdAt: Date.now(),
    });
    setSavedViews(next);
    setSelectedViewId(id);
  };
  const applySavedView = (viewId: string) => {
    if (viewId === "none") {
      setSelectedViewId("none");
      return;
    }
    const view = savedViews.find((v) => v.id === viewId);
    if (!view?.filters) return;
    setSearch(view.filters.search ?? "");
    setSortBy((view.filters.sortBy as typeof sortBy) ?? "newest");
    setStatusFilters((view.filters.statuses ?? "").split(",").filter(Boolean) as ClientRow["status"][]);
    setSelectedViewId(viewId);
  };
  const getSortIcon = (asc: string, desc: string) =>
    sortBy === asc ? "↑" : sortBy === desc ? "↓" : "↕";
  const toggleSort = (asc: typeof sortBy, desc: typeof sortBy) => {
    setSortBy((prev) => (prev === asc ? desc : asc));
  };

  return (
    <>
      <div
        className="mb-4 flex flex-wrap items-center justify-between gap-2"
        dir={tableDir}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/clients?tab=all")}
            className={
              selectedTab === "all"
                ? "rounded-md bg-white px-3 py-1 text-sm font-medium shadow-sm"
                : "cursor-pointer px-3 py-1 text-sm text-neutral-500 hover:text-neutral-700"
            }
          >
            {t("tabAll")}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/clients?tab=active")}
            className={
              selectedTab === "active"
                ? "rounded-md bg-white px-3 py-1 text-sm font-medium shadow-sm"
                : "cursor-pointer px-3 py-1 text-sm text-neutral-500 hover:text-neutral-700"
            }
          >
            {t("tabActive")}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/clients?tab=archived")}
            className={
              selectedTab === "archived"
                ? "rounded-md bg-white px-3 py-1 text-sm font-medium shadow-sm"
                : "cursor-pointer px-3 py-1 text-sm text-neutral-500 hover:text-neutral-700"
            }
          >
            {t("tabArchived")}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={selectedViewId} onValueChange={applySavedView}>
            <SelectTrigger
              size="sm"
              className="h-8 w-auto min-w-40 gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-normal text-neutral-700 shadow-none hover:bg-neutral-50 focus-visible:border-neutral-300 focus-visible:ring-[3px] focus-visible:ring-neutral-400/25"
            >
              <SelectValue placeholder="Views" />
            </SelectTrigger>
            <SelectContent align="start" position="popper" sideOffset={4}>
              <SelectItem value="none">Default view</SelectItem>
              {savedViews.map((view) => (
                <SelectItem key={view.id} value={view.id}>
                  {view.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50"
            onClick={saveCurrentView}
          >
            Save view
          </button>
          <button
            type="button"
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
            disabled={selectedViewId === "none"}
            onClick={() => {
              if (selectedViewId === "none") return;
              const next = removeSavedView("clients-table", selectedViewId);
              setSavedViews(next);
              setSelectedViewId("none");
            }}
          >
            Delete view
          </button>
          <div className="flex w-56 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-400">
            <Search className="h-4 w-4 shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholderShort")}
              className="w-full bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
            />
          </div>
          <Select
            value={sortBy}
            onValueChange={(v) =>
              setSortBy(
                v as
                  | "newest"
                  | "oldest"
                  | "name"
                  | "contact_asc"
                  | "contact_desc"
                  | "projects_asc"
                  | "projects_desc"
                  | "status_asc"
                  | "status_desc"
              )
            }
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-auto min-w-40 gap-2 rounded-lg border border-neutral-200 bg-white px-3 text-sm font-normal text-neutral-700 shadow-none hover:bg-neutral-50 focus-visible:border-neutral-300 focus-visible:ring-[3px] focus-visible:ring-neutral-400/25"
            >
              <ArrowUpDown className="h-4 w-4 shrink-0 text-neutral-500" aria-hidden />
              <SelectValue placeholder={tc("sort")} />
            </SelectTrigger>
            <SelectContent align="start" position="popper" sideOffset={4}>
              <SelectGroup>
                <SelectLabel>{tc("sort")}</SelectLabel>
                <SelectItem value="newest">{t("sortNewest")}</SelectItem>
                <SelectItem value="oldest">{t("sortOldest")}</SelectItem>
                <SelectItem value="name">{t("sortByName")}</SelectItem>
                <SelectItem value="contact_asc">{t("tableContact")} ↑</SelectItem>
                <SelectItem value="contact_desc">{t("tableContact")} ↓</SelectItem>
                <SelectItem value="projects_asc">{t("tableProjects")} ↑</SelectItem>
                <SelectItem value="projects_desc">{t("tableProjects")} ↓</SelectItem>
                <SelectItem value="status_asc">{t("tableStatus")} ↑</SelectItem>
                <SelectItem value="status_desc">{t("tableStatus")} ↓</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50"
              >
                <SlidersHorizontal className="h-4 w-4 shrink-0" />
                {tc("filter")}
                {activeFilterCount > 0 ? (
                  <span className="rounded-full bg-neutral-900 px-1.5 text-xs text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-40">
              <DropdownMenuLabel>{tc("filter")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {CLIENT_STATUSES.map((status) => (
                <DropdownMenuCheckboxItem
                  key={status}
                  checked={statusFilterSet.has(status)}
                  onCheckedChange={() => toggleStatusFilter(status)}
                >
                  <span className="inline-flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${statusDotClass(status)}`} aria-hidden />
                    {statusLabel(status)}
                  </span>
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={activeFilterCount === 0}
                onSelect={() => setStatusFilters([])}
              >
                {t("clearSelection")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div
          className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-2.5"
          dir={tableDir}
        >
          <span className="text-sm font-medium text-neutral-800">
            {t("bulkSelected", { count: selectedIds.size })}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-sm text-neutral-600 transition-colors hover:text-neutral-900"
              onClick={() => setSelectedIds(new Set())}
            >
              {t("clearSelection")}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-white hover:bg-destructive/90"
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              {tc("delete")}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse" dir={tableDir}>
          <thead className="border-b border-neutral-100 bg-neutral-50">
            <tr>
              <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded accent-neutral-900"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAll}
                  aria-label={t("selectAllRows")}
                />
              </th>
              <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                <button type="button" onClick={() => toggleSort("name", "name")} className="inline-flex items-center gap-1">
                  {t("tableClient")} {getSortIcon("name", "name")}
                </button>
              </th>
              <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                <button type="button" onClick={() => toggleSort("contact_asc", "contact_desc")} className="inline-flex items-center gap-1">
                  {t("tableContact")} {getSortIcon("contact_asc", "contact_desc")}
                </button>
              </th>
              <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                <button type="button" onClick={() => toggleSort("projects_asc", "projects_desc")} className="inline-flex items-center gap-1">
                  {t("tableProjects")} {getSortIcon("projects_asc", "projects_desc")}
                </button>
              </th>
              <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                <button type="button" onClick={() => toggleSort("oldest", "newest")} className="inline-flex items-center gap-1">
                  {t("tableAddedDate")} {getSortIcon("oldest", "newest")}
                </button>
              </th>
              <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                <button type="button" onClick={() => toggleSort("status_asc", "status_desc")} className="inline-flex items-center gap-1">
                  {t("tableStatus")} {getSortIcon("status_asc", "status_desc")}
                </button>
              </th>
              <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400"></th>
            </tr>
          </thead>
          <tbody>
            {visibleClients.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-neutral-400" colSpan={7}>
                  {t("noMatchingRows")}
                </td>
              </tr>
            ) : (
              visibleClients.map((client) => (
                <tr
                  key={client.id}
                  className="group cursor-pointer border-b border-neutral-50 transition-colors last:border-0 hover:bg-neutral-50"
                >
                  <td className="px-4 py-3 text-start">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded accent-neutral-900"
                      checked={selectedIds.has(client.id)}
                      onChange={() => toggleRow(client.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={client.companyName ?? ""}
                    />
                  </td>
                  <td className="px-4 py-3 text-start">
                    <Link href={`/dashboard/clients/${client.id}`}>
                      <div className="flex items-center gap-2.5">
                        <ClientAvatar name={client.companyName} logoUrl={client.logoUrl} />
                        <div className="text-sm font-medium text-neutral-900">{client.companyName}</div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-start">
                    <div className="text-sm text-neutral-800">{client.contactName || "—"}</div>
                    <div className="mt-0.5 text-xs text-neutral-400">{client.contactPhone || "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-start text-sm text-neutral-400">
                    {client.projectCount}{" "}
                    {t("projectsCount")}
                  </td>
                  <td className="px-4 py-3 text-start text-sm text-neutral-400">
                    {new Date(client.createdAt).toLocaleDateString(dateLocale, {
                      month: "long",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-start" onClick={(e) => e.stopPropagation()}>
                    <ClientStatusCell client={client} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                        onClick={() => setEditingClient(client)}
                      >
                        ✎
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600"
                          >
                            ⋯
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuLabel>{tc("actions")}</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/dashboard/clients/${client.id}`}>{t("viewClient")}</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => setEditingClient(client)}>{tc("edit")}</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={(e) => {
                              e.preventDefault();
                              setClientToDelete(client);
                            }}
                          >
                            <Trash2 className="me-2 h-4 w-4" />
                            {tc("delete")}
                          </DropdownMenuItem>
                          {selectedTab === "archived" ? (
                            <DropdownMenuItem
                              className="text-green-600 focus:text-green-600"
                              onSelect={async () => {
                                const result = await unarchiveClient(client.id);
                                if (result.ok) {
                                  toast.success(t("restoreSuccess"));
                                  router.refresh();
                                } else {
                                  const err = typeof result.error === "string" ? result.error : "";
                                  toast.error(isDbErrorKey(err) ? translateErr(err) : err);
                                }
                              }}
                            >
                              <ArchiveRestore className="me-2 h-4 w-4" />
                              {t("restore")}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              className="text-amber-600 focus:text-amber-600"
                              onSelect={async () => {
                                const result = await archiveClient(client.id);
                                if (result.ok) {
                                  toast.success(t("archiveSuccess"));
                                  router.refresh();
                                } else {
                                  const err = typeof result.error === "string" ? result.error : "";
                                  toast.error(isDbErrorKey(err) ? translateErr(err) : err);
                                }
                              }}
                            >
                              <Archive className="me-2 h-4 w-4" />
                              {t("archive")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3">
          <span className="text-xs text-neutral-400">
            {t("paginationShowing", { visible: visibleClients.length, total: allClients.length })}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              className="rounded-md border border-neutral-200 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50"
            >
              {tc("previous")}
            </button>
            <button
              type="button"
              className="rounded-md border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-800"
            >
              1
            </button>
            <button
              type="button"
              className="rounded-md border border-neutral-200 px-3 py-1 text-xs text-neutral-500 hover:bg-neutral-50"
            >
              {tc("next")}
            </button>
          </div>
        </div>
      </div>

      <ClientFormSheet
        open={!!editingClient}
        onOpenChange={(open) => !open && setEditingClient(null)}
        client={editingClient ?? undefined}
        serviceOptions={serviceOptions}
        initialServiceIds={
          editingClient ? (clientServiceMap[editingClient.id] ?? []).map((s) => s.id) : []
        }
      />

      <AlertDialog
        open={!!clientToDelete || bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open) {
            setClientToDelete(null);
            setBulkDeleteOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {bulkDeleteOpen ? t("bulkDeleteConfirmTitle") : t("deleteConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {bulkDeleteOpen
                ? t("bulkDeleteConfirmBody", { count: selectedIds.size })
                : clientToDelete
                  ? t("deleteConfirmBody", { name: clientToDelete.companyName })
                  : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (bulkDeleteOpen) {
                  const ids = [...selectedIds];
                  if (ids.length === 0) {
                    setBulkDeleteOpen(false);
                    return;
                  }
                  const res = await deleteClients(ids);
                  if (res.ok) {
                    toast.success(t("bulkDeleteSuccess", { count: ids.length }));
                    setSelectedIds(new Set());
                    setBulkDeleteOpen(false);
                    router.refresh();
                  } else {
                    const err = typeof res.error === "string" ? res.error : "";
                    toast.error(isDbErrorKey(err) ? translateErr(err) : err);
                  }
                  return;
                }
                if (!clientToDelete) return;
                const res = await deleteClient(clientToDelete.id);
                if (res.ok) {
                  toast.success(t("deleteSuccess"));
                  router.refresh();
                } else {
                  const err = typeof res.error === "string" ? res.error : "";
                  toast.error(isDbErrorKey(err) ? translateErr(err) : err);
                }
                setClientToDelete(null);
              }}
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
