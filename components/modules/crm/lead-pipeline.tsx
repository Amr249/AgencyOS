"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { GripVertical } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { toast } from "sonner";

import { updateClient, type ClientPipelineItem } from "@/actions/clients";
import { ClientLostDialog } from "@/components/modules/crm/client-lost-dialog";
import { markClientLost, markClientWon } from "@/actions/win-loss";
import type { ClientLossCategory } from "@/lib/client-loss";
import { CLIENT_SOURCE_VALUES } from "@/lib/client-constants";
import { useTranslateActionError } from "@/hooks/use-translate-action-error";
import { isDbErrorKey } from "@/lib/i18n-errors";
import { cn, formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SarMoney } from "@/components/ui/sar-money";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const PIPELINE_STATUSES = [
  "lead",
  "active",
  "on_hold",
  "completed",
  "closed",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

const COLUMN_PREFIX = "column:" as const;
const CLIENT_PREFIX = "client:" as const;

function columnDroppableId(status: PipelineStatus): string {
  return `${COLUMN_PREFIX}${status}`;
}

function parseColumnDropId(id: string): PipelineStatus | null {
  const s = String(id);
  if (!s.startsWith(COLUMN_PREFIX)) return null;
  const rest = s.slice(COLUMN_PREFIX.length);
  return PIPELINE_STATUSES.includes(rest as PipelineStatus) ? (rest as PipelineStatus) : null;
}

const clientDragId = (clientId: string) => `${CLIENT_PREFIX}${clientId}` as const;

const CUSTOM_REASON = "__custom__";

const pipelineCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  const col = hits.find((h) => String(h.id).startsWith(COLUMN_PREFIX));
  return col ? [col] : hits;
};

const COLUMN_SURFACE: Record<PipelineStatus, string> = {
  lead: "border-blue-200/80 bg-blue-50/50",
  active: "border-emerald-200/80 bg-emerald-50/50",
  on_hold: "border-amber-200/80 bg-amber-50/50",
  completed: "border-neutral-200/80 bg-neutral-100/50",
  closed: "border-rose-200/80 bg-rose-50/50",
};

const COLUMN_HEADER: Record<PipelineStatus, string> = {
  lead: "border-b border-blue-200/80 bg-blue-100/90",
  active: "border-b border-emerald-200/80 bg-emerald-100/90",
  on_hold: "border-b border-amber-200/80 bg-amber-100/90",
  completed: "border-b border-neutral-200/80 bg-neutral-200/90",
  closed: "border-b border-rose-200/80 bg-rose-100/90",
};

const COLUMN_DOT: Record<PipelineStatus, string> = {
  lead: "bg-blue-500",
  active: "bg-emerald-500",
  on_hold: "bg-amber-500",
  completed: "bg-neutral-500",
  closed: "bg-rose-500",
};

function tagBadgeClass(color: string) {
  const c = color.toLowerCase();
  const map: Record<string, string> = {
    blue: "border-blue-200 bg-blue-50 text-blue-800",
    green: "border-emerald-200 bg-emerald-50 text-emerald-800",
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    yellow: "border-yellow-200 bg-yellow-50 text-yellow-900",
    purple: "border-purple-200 bg-purple-50 text-purple-800",
    pink: "border-pink-200 bg-pink-50 text-pink-800",
    neutral: "border-neutral-200 bg-neutral-100 text-neutral-800",
  };
  return map[c] ?? "border-neutral-200 bg-neutral-100 text-neutral-800";
}

function formatSourceLabel(source: string | null) {
  if (!source) return "—";
  return source
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

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
        width={36}
        height={36}
        className="h-9 w-9 shrink-0 rounded-lg object-cover"
        onError={() => setLogoFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
        colors[index]
      )}
    >
      {name[0] ?? "?"}
    </div>
  );
}

function PipelineDroppableColumn({
  status,
  count,
  title,
  children,
}: {
  status: PipelineStatus;
  count: number;
  title: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: columnDroppableId(status),
    data: { type: "column" as const, status },
  });

  return (
    <div ref={setNodeRef} className="min-w-[280px] max-w-[280px] shrink-0">
      <Card
        className={cn(
          "flex h-full min-h-[min(72vh,560px)] flex-col gap-0 border-2 py-0 shadow-sm transition-[box-shadow,ring]",
          COLUMN_SURFACE[status],
          isOver && "ring-primary ring-2 ring-offset-2 ring-offset-background"
        )}
      >
        <CardHeader className={cn("px-4 py-3.5", COLUMN_HEADER[status])}>
          <div className="flex items-center gap-2.5">
            <span className={cn("h-2 w-2 rounded-full", COLUMN_DOT[status])} />
            <span className="font-semibold tracking-tight">{title}</span>
            <span className="text-muted-foreground text-sm tabular-nums">({count})</span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-4 pt-3">
          {children}
        </CardContent>
      </Card>
    </div>
  );
}

function PipelineDraggableCard({ client }: { client: ClientPipelineItem }) {
  const t = useTranslations("clients");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: clientDragId(client.id),
    data: {
      type: "client" as const,
      clientId: client.id,
      status: client.status,
    },
  });

  const created =
    client.createdAt instanceof Date
      ? formatDate(client.createdAt.toISOString())
      : formatDate(String(client.createdAt));

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      className={cn(
        "flex gap-0 overflow-hidden rounded-xl border border-neutral-200/90 bg-white shadow-sm transition-shadow",
        isDragging && "opacity-50"
      )}
    >
      <button
        type="button"
        className="text-muted-foreground hover:bg-muted/60 flex shrink-0 cursor-grab touch-none items-center border-r border-neutral-100 px-1.5 active:cursor-grabbing"
        aria-label="Drag to move"
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1 p-3">
        <Link
          href={`/dashboard/clients/${client.id}`}
          className="hover:text-primary mb-2 flex items-start gap-2.5 transition-colors"
        >
          <ClientAvatar name={client.companyName} logoUrl={client.logoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight text-neutral-900">
              {client.companyName}
            </p>
            {client.contactName ? (
              <p className="text-muted-foreground mt-0.5 truncate text-xs">{client.contactName}</p>
            ) : null}
          </div>
        </Link>

        {client.tags.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1">
            {client.tags.map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className={cn("text-[10px] font-medium", tagBadgeClass(tag.color))}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="text-muted-foreground space-y-1 text-[11px] leading-snug">
          <div className="flex justify-between gap-2">
            <span>{formatSourceLabel(client.source)}</span>
            <span className="tabular-nums text-neutral-500">{created}</span>
          </div>
          {client.potentialValue ? (
            <div className="border-border/60 mt-1 border-t pt-1.5">
              <p className="text-muted-foreground mb-0.5 text-[10px] font-medium uppercase tracking-wide">
                {t("pipelinePotential")}
              </p>
              <SarMoney value={client.potentialValue} className="text-xs font-semibold" iconClassName="h-3 w-3" />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PipelineCardPreview({ client }: { client: ClientPipelineItem }) {
  const created =
    client.createdAt instanceof Date
      ? formatDate(client.createdAt.toISOString())
      : formatDate(String(client.createdAt));

  return (
    <div className="w-[260px] overflow-hidden rounded-xl border-2 border-primary/30 bg-white p-3 shadow-lg">
      <div className="flex items-start gap-2">
        <ClientAvatar name={client.companyName} logoUrl={client.logoUrl} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{client.companyName}</p>
          {client.contactName ? (
            <p className="text-muted-foreground truncate text-xs">{client.contactName}</p>
          ) : null}
        </div>
      </div>
      <p className="text-muted-foreground mt-2 text-[10px] tabular-nums">{created}</p>
    </div>
  );
}

type LeadPipelineProps = {
  initialClients: ClientPipelineItem[];
  wonReasons: { id: string; reason: string }[];
};

export function LeadPipeline({ initialClients, wonReasons }: LeadPipelineProps) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const router = useRouter();
  const translateErr = useTranslateActionError();

  const [clients, setClients] = React.useState<ClientPipelineItem[]>(initialClients);
  const [search, setSearch] = React.useState("");
  const [tagFilter, setTagFilter] = React.useState<string>("all");
  const [sourceFilter, setSourceFilter] = React.useState<string>("all");
  const [activeClient, setActiveClient] = React.useState<ClientPipelineItem | null>(null);
  const [winDialog, setWinDialog] = React.useState<{ clientId: string; companyName: string } | null>(
    null
  );
  const [lossDialog, setLossDialog] = React.useState<{ clientId: string; companyName: string } | null>(
    null
  );
  const [winReasonKey, setWinReasonKey] = React.useState<string>("");
  const [winCustomReason, setWinCustomReason] = React.useState("");
  const [winDealValue, setWinDealValue] = React.useState("");
  const [outcomePending, setOutcomePending] = React.useState(false);

  const clientsRef = React.useRef(clients);
  React.useEffect(() => {
    clientsRef.current = clients;
  }, [clients]);

  React.useEffect(() => {
    setClients(initialClients);
  }, [initialClients]);

  const tagOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const c of initialClients) {
      for (const tag of c.tags) {
        map.set(tag.id, tag.name);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [initialClients]);

  const columnTitle = React.useCallback(
    (status: PipelineStatus) => {
      if (status === "lead") return t("statusLeadFull");
      if (status === "active") return tc("active");
      if (status === "on_hold") return t("statusOnHold");
      if (status === "completed") return tc("completed");
      if (status === "closed") return t("pipelineColumnLost");
      return t("statusClosed");
    },
    [t, tc]
  );

  const filtered = React.useMemo(() => {
    let list = clients;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.companyName.toLowerCase().includes(q) ||
          (c.contactName?.toLowerCase().includes(q) ?? false)
      );
    }
    if (tagFilter !== "all") {
      list = list.filter((c) => c.tags.some((x) => x.id === tagFilter));
    }
    if (sourceFilter !== "all") {
      list = list.filter((c) => c.source === sourceFilter);
    }
    return list;
  }, [clients, search, tagFilter, sourceFilter]);

  const byStatus = React.useMemo(() => {
    const m: Record<PipelineStatus, ClientPipelineItem[]> = {
      lead: [],
      active: [],
      on_hold: [],
      completed: [],
      closed: [],
    };
    for (const c of filtered) {
      m[c.status].push(c);
    }
    return m;
  }, [filtered]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const persistStatus = React.useCallback(
    async (clientId: string, newStatus: PipelineStatus) => {
      const list = clientsRef.current;
      const row = list.find((c) => c.id === clientId);
      if (!row || row.status === newStatus) return;
      const prevStatus = row.status;
      setClients((prevList) =>
        prevList.map((c) => (c.id === clientId ? { ...c, status: newStatus } : c))
      );
      const res = await updateClient({ id: clientId, status: newStatus });
      if (!res.ok) {
        setClients((prevList) =>
          prevList.map((c) => (c.id === clientId ? { ...c, status: prevStatus } : c))
        );
        const err = "_form" in res.error ? res.error._form?.[0] : undefined;
        const errStr = typeof err === "string" ? err : "";
        const msg = isDbErrorKey(errStr) ? translateErr(errStr) : errStr;
        toast.error(msg || t("pipelineStatusError"));
        return;
      }
      toast.success(t("pipelineStatusUpdated"));
      router.refresh();
    },
    [router, t, translateErr]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    if (!id.startsWith(CLIENT_PREFIX)) return;
    const clientId = id.slice(CLIENT_PREFIX.length);
    const row = clientsRef.current.find((c) => c.id === clientId);
    if (row) setActiveClient(row);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveClient(null);
    const { active, over } = event;
    if (!over) return;

    const newStatus = parseColumnDropId(String(over.id));
    if (!newStatus) return;

    const activeStr = String(active.id);
    if (!activeStr.startsWith(CLIENT_PREFIX)) return;
    const clientId = activeStr.slice(CLIENT_PREFIX.length);

    const data = active.data.current as { status?: PipelineStatus } | undefined;
    if (data?.status === newStatus) return;

    if (newStatus === "completed") {
      const row = clientsRef.current.find((c) => c.id === clientId);
      if (row) {
        setWinReasonKey(wonReasons[0]?.reason ?? CUSTOM_REASON);
        setWinCustomReason("");
        setWinDealValue("");
        setWinDialog({ clientId, companyName: row.companyName });
      }
      return;
    }
    if (newStatus === "closed") {
      const row = clientsRef.current.find((c) => c.id === clientId);
      if (row) {
        setLossDialog({ clientId, companyName: row.companyName });
      }
      return;
    }

    void persistStatus(clientId, newStatus);
  };

  const resolveWinReason = () => {
    if (winReasonKey === CUSTOM_REASON) return winCustomReason.trim();
    return winReasonKey.trim();
  };

  const submitWin = async () => {
    if (!winDialog || outcomePending) return;
    const reason = resolveWinReason();
    if (!reason) {
      toast.error(tc("error"));
      return;
    }
    setOutcomePending(true);
    try {
      const dealNum = winDealValue.trim() === "" ? NaN : Number(winDealValue);
      const res = await markClientWon({
        clientId: winDialog.clientId,
        reason,
        ...(Number.isFinite(dealNum) && dealNum >= 0 ? { dealValue: dealNum } : {}),
      });
      if (!res.ok) {
        const err = "_form" in res.error ? res.error._form?.[0] : undefined;
        const fieldErr = Object.values(res.error).flat()[0];
        const errStr = typeof err === "string" ? err : typeof fieldErr === "string" ? fieldErr : "";
        toast.error(isDbErrorKey(errStr) ? translateErr(errStr) : errStr || t("pipelineWinLossError"));
        return;
      }
      setClients((prev) =>
        prev.map((c) => (c.id === winDialog.clientId ? { ...c, status: "completed" as const } : c))
      );
      setWinDialog(null);
      toast.success(t("pipelineWinSaved"));
      router.refresh();
    } finally {
      setOutcomePending(false);
    }
  };

  const submitLoss = async (payload: {
    lossCategory: ClientLossCategory;
    notes: string;
  }) => {
    if (!lossDialog || outcomePending) return;
    if (!payload.notes.trim()) {
      toast.error(t("lossNotesRequired"));
      return;
    }
    setOutcomePending(true);
    try {
      const res = await markClientLost({
        clientId: lossDialog.clientId,
        lossCategory: payload.lossCategory,
        notes: payload.notes.trim(),
      });
      if (!res.ok) {
        const err = "_form" in res.error ? res.error._form?.[0] : undefined;
        const fieldErr = Object.values(res.error).flat()[0];
        const errStr = typeof err === "string" ? err : typeof fieldErr === "string" ? fieldErr : "";
        toast.error(isDbErrorKey(errStr) ? translateErr(errStr) : errStr || t("pipelineWinLossError"));
        return;
      }
      setClients((prev) =>
        prev.map((c) => (c.id === lossDialog.clientId ? { ...c, status: "closed" as const } : c))
      );
      setLossDialog(null);
      toast.success(t("pipelineLostSaved"));
      router.refresh();
    } finally {
      setOutcomePending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("pipelineSearch")}
            className="h-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="h-10 w-[160px]">
              <SelectValue placeholder={t("pipelineTag")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tc("all")}</SelectItem>
              {tagOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-10 w-[180px]">
              <SelectValue placeholder={t("pipelineSource")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tc("all")}</SelectItem>
              {CLIENT_SOURCE_VALUES.map((src) => (
                <SelectItem key={src} value={src}>
                  {formatSourceLabel(src)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={pipelineCollision}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveClient(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-2 pt-1" dir="ltr">
          {PIPELINE_STATUSES.map((status) => (
            <PipelineDroppableColumn
              key={status}
              status={status}
              count={byStatus[status].length}
              title={columnTitle(status)}
            >
              {byStatus[status].length === 0 ? (
                <p className="text-muted-foreground px-1 py-6 text-center text-xs">
                  {t("pipelineEmptyColumn")}
                </p>
              ) : (
                byStatus[status].map((client) => (
                  <PipelineDraggableCard key={client.id} client={client} />
                ))
              )}
            </PipelineDroppableColumn>
          ))}
        </div>

        <DragOverlay
          dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18, 0.67, 0.6, 1)" }}
        >
          {activeClient ? (
            <div className="cursor-grabbing">
              <PipelineCardPreview client={activeClient} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <Dialog
        modal={false}
        open={!!winDialog}
        onOpenChange={(open) => {
          if (!open && !outcomePending) setWinDialog(null);
        }}
      >
        <DialogContent
          key={winDialog?.clientId ?? "win-dialog"}
          className="sm:max-w-md"
          showCloseButton={!outcomePending}
        >
          <DialogHeader>
            <DialogTitle>{t("pipelineMarkWonTitle")}</DialogTitle>
            <DialogDescription>
              {winDialog ? (
                <>
                  <span className="font-medium text-foreground">{winDialog.companyName}</span>
                  {" — "}
                  {t("pipelineMarkWonDesc")}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-2">
              <Label htmlFor="win-reason">{t("pipelineReasonLabel")}</Label>
              <Select
                value={winReasonKey}
                onValueChange={(v) => {
                  setWinReasonKey(v);
                  if (v !== CUSTOM_REASON) setWinCustomReason("");
                }}
              >
                <SelectTrigger id="win-reason" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {wonReasons.map((r) => (
                    <SelectItem key={r.id} value={r.reason}>
                      {r.reason}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_REASON}>{t("pipelineReasonCustom")}</SelectItem>
                </SelectContent>
              </Select>
              {winReasonKey === CUSTOM_REASON ? (
                <Textarea
                  value={winCustomReason}
                  onChange={(e) => setWinCustomReason(e.target.value)}
                  placeholder={t("pipelineReasonCustom")}
                  rows={2}
                  className="resize-none"
                />
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="win-deal">{t("pipelineDealValueLabel")}</Label>
              <Input
                id="win-deal"
                type="number"
                min={0}
                step="0.01"
                value={winDealValue}
                onChange={(e) => setWinDealValue(e.target.value)}
                placeholder="0"
              />
              <p className="text-muted-foreground text-xs">{t("pipelineDealValueHint")}</p>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={outcomePending} onClick={() => setWinDialog(null)}>
              {t("pipelineCancel")}
            </Button>
            <Button type="button" disabled={outcomePending} onClick={() => void submitWin()}>
              {t("pipelineSaveOutcome")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ClientLostDialog
        key={lossDialog?.clientId ?? "loss-none"}
        modal={false}
        open={!!lossDialog}
        onOpenChange={(open) => {
          if (!open && !outcomePending) setLossDialog(null);
        }}
        companyName={lossDialog?.companyName ?? ""}
        pending={outcomePending}
        onConfirm={(p) => void submitLoss(p)}
      />
    </div>
  );
}
