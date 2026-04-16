"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";

type SearchResults = {
  clients: { id: string; companyName: string; status: string }[];
  projects: { id: string; name: string; clientName: string }[];
  invoices: { id: string; invoiceNumber: string; clientName: string }[];
  tasks: { id: string; title: string; projectName: string }[];
};

const emptyResults: SearchResults = {
  clients: [],
  projects: [],
  invoices: [],
  tasks: [],
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(emptyResults);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("search");
  const tc = useTranslations("common");
  const dir = locale === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(emptyResults);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data);
      } catch {
        setResults(emptyResults);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  const hasResults =
    results.clients.length > 0 ||
    results.projects.length > 0 ||
    results.invoices.length > 0 ||
    results.tasks.length > 0;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-9 w-9 shrink-0 sm:hidden"
      >
        <Search className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        dir={dir}
        className="hidden h-9 w-52 shrink-0 items-center gap-3 rounded-lg border-0 bg-muted/50 px-3 text-[15px] text-muted-foreground hover:bg-muted sm:flex"
      >
        <span className="flex-1 text-start">{tc("search")}</span>
        <span dir="ltr" className="flex items-center gap-0.5">
          <kbd className="rounded border bg-background px-1 py-0.5 font-sans text-[11px] leading-none">
            ⌘
          </kbd>
          <kbd className="rounded border bg-background px-1 py-0.5 font-sans text-[11px] leading-none">
            K
          </kbd>
        </span>
        <Search className="h-3.5 w-3.5 shrink-0" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} dir={dir}>
        <CommandInput
          placeholder={t("placeholder")}
          value={query}
          onValueChange={setQuery}
          dir={dir}
        />
        <CommandList dir={dir}>
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">{t("searching")}</div>
          )}
          {!loading && query.length >= 2 && !hasResults && (
            <CommandEmpty>{t("noResults", { query })}</CommandEmpty>
          )}
          {!loading && query.length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">{t("typeToSearch")}</div>
          )}

          {!loading && results.clients.length > 0 && (
            <CommandGroup heading={t("groupClients")}>
              {results.clients.map((client) => (
                <CommandItem
                  key={client.id}
                  onSelect={() => navigate(`/dashboard/clients/${client.id}`)}
                  className="flex cursor-pointer items-center justify-between gap-2"
                  dir={dir}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {client.companyName[0]}
                    </div>
                    <span>{client.companyName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{client.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && results.projects.length > 0 && (
            <CommandGroup heading={t("groupProjects")}>
              {results.projects.map((project) => (
                <CommandItem
                  key={project.id}
                  onSelect={() => navigate(`/dashboard/projects/${project.id}`)}
                  className="flex cursor-pointer items-center justify-between gap-2"
                  dir={dir}
                >
                  <span>{project.name}</span>
                  <span className="text-xs text-muted-foreground">{project.clientName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && results.invoices.length > 0 && (
            <CommandGroup heading={t("groupInvoices")}>
              {results.invoices.map((invoice) => (
                <CommandItem
                  key={invoice.id}
                  onSelect={() => navigate(`/dashboard/invoices/${invoice.id}`)}
                  className="flex cursor-pointer items-center justify-between gap-2"
                  dir={dir}
                >
                  <span>{invoice.invoiceNumber}</span>
                  <span className="text-xs text-muted-foreground">{invoice.clientName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && results.tasks.length > 0 && (
            <CommandGroup heading={t("groupTasks")}>
              {results.tasks.map((task) => (
                <CommandItem
                  key={task.id}
                  onSelect={() => navigate(`/dashboard/workspace?task=${task.id}`)}
                  className="flex cursor-pointer items-center justify-between gap-2"
                  dir={dir}
                >
                  <span>{task.title}</span>
                  <span className="text-xs text-muted-foreground">{task.projectName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
