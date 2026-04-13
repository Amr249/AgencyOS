"use client";

import * as React from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parse,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  TEAM_AVAILABILITY_TYPES,
  type TeamAvailabilityType,
} from "@/lib/team-availability";
import { markUnavailable, markAvailable, type TeamAvailabilityRow } from "@/actions/team-availability";
import { useRouter } from "next/navigation";

const TYPE_LABEL: Record<TeamAvailabilityType, string> = {
  holiday: "Holiday",
  vacation: "Vacation",
  sick: "Sick",
  half_day: "Half day",
};

const TYPE_CELL_CLASS: Record<TeamAvailabilityType, string> = {
  holiday: "bg-violet-500/85 text-white",
  vacation: "bg-sky-600/90 text-white",
  sick: "bg-rose-600/90 text-white",
  half_day: "bg-amber-500/90 text-neutral-950",
};

const TYPE_DOT_CLASS: Record<TeamAvailabilityType, string> = {
  holiday: "bg-violet-500",
  vacation: "bg-sky-500",
  sick: "bg-rose-500",
  half_day: "bg-amber-500",
};

function normalizeType(t: string): TeamAvailabilityType {
  return (TEAM_AVAILABILITY_TYPES as readonly string[]).includes(t) ? (t as TeamAvailabilityType) : "vacation";
}

type MemberOption = { id: string; name: string };

function entriesByDate(entries: TeamAvailabilityRow[]): Map<string, TeamAvailabilityRow[]> {
  const m = new Map<string, TeamAvailabilityRow[]>();
  for (const e of entries) {
    const list = m.get(e.date) ?? [];
    list.push(e);
    m.set(e.date, list);
  }
  for (const list of m.values()) {
    list.sort((a, b) => a.memberName.localeCompare(b.memberName));
  }
  return m;
}

export function TeamAvailabilityCalendar({
  monthKey,
  entries,
  members,
}: {
  monthKey: string;
  entries: TeamAvailabilityRow[];
  members: MemberOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  const monthDate = React.useMemo(() => {
    const d = parse(`${monthKey}-01`, "yyyy-MM-dd", new Date());
    return Number.isNaN(d.getTime()) ? startOfMonth(new Date()) : d;
  }, [monthKey]);

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const gridDays = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const byDate = React.useMemo(() => entriesByDate(entries), [entries]);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState<TeamAvailabilityRow | null>(null);
  const [formMemberId, setFormMemberId] = React.useState<string>("");
  const [formType, setFormType] = React.useState<TeamAvailabilityType>("vacation");
  const [formNotes, setFormNotes] = React.useState("");

  function openAdd(dateIso: string) {
    setEditing(null);
    setSelectedDate(dateIso);
    setFormMemberId(members[0]?.id ?? "");
    setFormType("vacation");
    setFormNotes("");
    setDialogOpen(true);
  }

  function openEdit(row: TeamAvailabilityRow) {
    setEditing(row);
    setSelectedDate(row.date);
    setFormMemberId(row.teamMemberId);
    setFormType(normalizeType(row.type));
    setFormNotes(row.notes ?? "");
    setDialogOpen(true);
  }

  function shiftMonth(delta: number) {
    const next = format(addMonths(monthDate, delta), "yyyy-MM");
    router.push(`/dashboard/workspace/availability?month=${next}`);
  }

  async function handleSave() {
    if (!selectedDate || !formMemberId) {
      toast.error("Choose a team member.");
      return;
    }
    startTransition(async () => {
      const res = await markUnavailable({
        teamMemberId: formMemberId,
        date: selectedDate,
        type: formType,
        notes: formNotes.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(editing ? "Availability updated" : "Marked unavailable");
      setDialogOpen(false);
      router.refresh();
    });
  }

  async function handleDelete() {
    if (!editing) return;
    startTransition(async () => {
      const res = await markAvailable(editing.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Availability cleared");
      setDialogOpen(false);
      router.refresh();
    });
  }

  const weekDayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="space-y-4" dir="ltr" lang="en">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="min-w-[160px] text-center font-semibold text-lg">{format(monthDate, "MMMM yyyy")}</h2>
          <Button type="button" variant="outline" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={() => router.push("/dashboard/workspace/availability")}>
          This month
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        {(TEAM_AVAILABILITY_TYPES as readonly TeamAvailabilityType[]).map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className={cn("size-3 rounded-sm", TYPE_DOT_CLASS[t])} />
            <span>{TYPE_LABEL[t]}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <div className="grid min-w-[720px] grid-cols-7 gap-px bg-border p-px">
          {weekDayLabels.map((d) => (
            <div key={d} className="bg-muted/50 px-2 py-2 text-center font-medium text-muted-foreground text-xs">
              {d}
            </div>
          ))}
          {gridDays.map((day) => {
            const iso = format(day, "yyyy-MM-dd");
            const inMonth = isSameMonth(day, monthDate);
            const dayEntries = byDate.get(iso) ?? [];
            return (
              <div
                key={iso}
                className={cn(
                  "flex min-h-[100px] flex-col gap-1 bg-card p-1.5 text-left",
                  !inMonth && "opacity-40"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={cn("font-medium text-xs tabular-nums", inMonth ? "text-foreground" : "text-muted-foreground")}>
                    {format(day, "d")}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px] text-muted-foreground"
                    disabled={pending}
                    onClick={() => openAdd(iso)}
                  >
                    + Add
                  </Button>
                </div>
                <div className="flex min-h-[48px] flex-1 flex-col gap-1">
                  {dayEntries.map((e) => {
                    const nt = normalizeType(e.type);
                    return (
                      <button
                        key={e.id}
                        type="button"
                        disabled={pending}
                        onClick={() => openEdit(e)}
                        className={cn(
                          "w-full rounded-md px-1.5 py-1 text-left text-[10px] leading-tight transition-opacity hover:opacity-90",
                          TYPE_CELL_CLASS[nt]
                        )}
                      >
                        <span className="line-clamp-2 font-medium">{e.memberName}</span>
                        <span className="opacity-90">{TYPE_LABEL[nt]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md" dir="ltr" lang="en">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit time off" : "Mark unavailable"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {selectedDate ? (
              <p className="text-muted-foreground text-sm">
                Date: <span className="font-medium text-foreground">{selectedDate}</span>
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label>Team member</Label>
              <Select value={formMemberId} onValueChange={setFormMemberId} disabled={!!editing}>
                <SelectTrigger>
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={formType} onValueChange={(v) => setFormType(v as TeamAvailabilityType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(TEAM_AVAILABILITY_TYPES as readonly TeamAvailabilityType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={formNotes} onChange={(ev) => setFormNotes(ev.target.value)} rows={3} placeholder="Optional note" />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {editing ? (
              <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => void handleDelete()}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Remove
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void handleSave()} disabled={pending}>
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
