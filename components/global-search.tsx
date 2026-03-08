"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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

  // Open on Cmd+K / Ctrl+K
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

  // Search as user types with debounce
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
      {/* Mobile: icon-only trigger */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        className="sm:hidden h-9 w-9 shrink-0"
      >
        <Search className="h-4 w-4" />
      </Button>
      {/* Desktop: minimal search bar */}
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        dir="rtl"
        className="hidden sm:flex items-center gap-3 h-9 px-3 text-sm text-muted-foreground bg-muted/50 border-0 rounded-lg w-52 hover:bg-muted shrink-0"
      >
        <span className="flex-1 text-right">بحث...</span>
        <div className="flex items-center gap-0.5">
          <kbd className="text-[11px] bg-background border rounded px-1 py-0.5 font-sans leading-none">
            ⌘
          </kbd>
          <kbd className="text-[11px] bg-background border rounded px-1 py-0.5 font-sans leading-none">
            K
          </kbd>
        </div>
        <Search className="h-3.5 w-3.5 shrink-0" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} dir="rtl">
        <CommandInput
          placeholder="ابحث عن عميل، مشروع، فاتورة، مهمة..."
          value={query}
          onValueChange={setQuery}
          dir="rtl"
        />
        <CommandList dir="rtl">
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              جارٍ البحث...
            </div>
          )}
          {!loading && query.length >= 2 && !hasResults && (
            <CommandEmpty>لا توجد نتائج لـ &quot;{query}&quot;</CommandEmpty>
          )}
          {!loading && query.length < 2 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              اكتب للبحث...
            </div>
          )}

          {!loading && results.clients.length > 0 && (
            <CommandGroup heading="👥 العملاء">
              {results.clients.map((client) => (
                <CommandItem
                  key={client.id}
                  onSelect={() => navigate(`/dashboard/clients/${client.id}`)}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  dir="rtl"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                      {client.companyName[0]}
                    </div>
                    <span>{client.companyName}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {client.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && results.projects.length > 0 && (
            <CommandGroup heading="📁 المشاريع">
              {results.projects.map((project) => (
                <CommandItem
                  key={project.id}
                  onSelect={() => navigate(`/dashboard/projects/${project.id}`)}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  dir="rtl"
                >
                  <span>{project.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {project.clientName}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && results.invoices.length > 0 && (
            <CommandGroup heading="🧾 الفواتير">
              {results.invoices.map((invoice) => (
                <CommandItem
                  key={invoice.id}
                  onSelect={() => navigate(`/dashboard/invoices/${invoice.id}`)}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  dir="rtl"
                >
                  <span>{invoice.invoiceNumber}</span>
                  <span className="text-xs text-muted-foreground">
                    {invoice.clientName}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!loading && results.tasks.length > 0 && (
            <CommandGroup heading="✅ المهام">
              {results.tasks.map((task) => (
                <CommandItem
                  key={task.id}
                  onSelect={() =>
                    navigate(`/dashboard/tasks?task=${task.id}`)
                  }
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  dir="rtl"
                >
                  <span>{task.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {task.projectName}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
