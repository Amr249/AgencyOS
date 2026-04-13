"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addDays, addWeeks, format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { logTime, deleteTimeLog, updateTimeLog } from "@/actions/time-tracking";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";
import {
  ProjectSelectThumb,
  TeamMemberSelectOptionRow,
  type ProjectPickerOption,
} from "@/components/entity-select-option";

type TeamMemberOption = { id: string; name: string; avatarUrl?: string | null };
type TaskOption = {
  id: string;
  title: string;
  projectName: string;
  projectCoverImageUrl?: string | null;
  projectClientLogoUrl?: string | null;
};

type TimesheetEntry = {
  id: string;
  taskId: string;
  description: string | null;
  hours: string | number;
  loggedAt: Date | string;
  isBillable: boolean;
  task?: { id: string; title: string; project?: { id: string; name: string } | null } | null;
};

type Props = {
  weekStart: string;
  selectedTeamMemberId?: string;
  teamMembers: TeamMemberOption[];
  tasks: TaskOption[];
  byDay: Record<string, TimesheetEntry[]>;
  dailyTotals: Record<string, number>;
  weekTotal: number;
  projects: ProjectPickerOption[];
};

type AddState = {
  open: boolean;
  day: string;
  taskId: string;
  hours: number;
  description: string;
  isBillable: boolean;
};

type EditState = {
  open: boolean;
  id: string;
  taskTitle: string;
  projectName: string;
  hours: number;
  description: string;
  isBillable: boolean;
};

function fmtHours(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  return `${text}h`;
}

export function WorkspaceTimesheetView({
  weekStart,
  selectedTeamMemberId,
  teamMembers,
  tasks,
  byDay,
  dailyTotals,
  weekTotal,
  projects,
}: Props) {
  const router = useRouter();

  const weekStartDate = parseISO(`${weekStart}T12:00:00`);
  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }).map((_, i) => addDays(weekStartDate, i)),
    [weekStartDate]
  );
  const weekRangeLabel = `${format(weekDays[0]!, "MMM d", { locale: enUS })} - ${format(
    weekDays[6]!,
    "MMM d, yyyy",
    { locale: enUS }
  )}`;

  const [addState, setAddState] = React.useState<AddState>({
    open: false,
    day: weekStart,
    taskId: "",
    hours: 1,
    description: "",
    isBillable: true,
  });

  const [editState, setEditState] = React.useState<EditState>({
    open: false,
    id: "",
    taskTitle: "",
    projectName: "",
    hours: 1,
    description: "",
    isBillable: true,
  });
  const [submitting, setSubmitting] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const updateQuery = React.useCallback(
    (next: { weekStart?: string; teamMemberId?: string }) => {
      const sp = new URLSearchParams();
      sp.set("weekStart", next.weekStart ?? weekStart);
      if (next.teamMemberId) sp.set("teamMemberId", next.teamMemberId);
      router.push(`/dashboard/workspace/timesheet?${sp.toString()}`);
    },
    [router, weekStart]
  );

  async function handleAddSubmit() {
    if (!addState.taskId) {
      toast.error("Select a task");
      return;
    }
    if (addState.hours < 0.25 || addState.hours > 24) {
      toast.error("Hours must be between 0.25 and 24");
      return;
    }
    setSubmitting(true);
    const res = await logTime({
      taskId: addState.taskId,
      hours: addState.hours,
      date: addState.day,
      description: addState.description.trim() || undefined,
      ...(selectedTeamMemberId ? { teamMemberId: selectedTeamMemberId } : {}),
      isBillable: addState.isBillable,
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Time logged");
      setAddState((s) => ({ ...s, open: false, taskId: "", hours: 1, description: "", isBillable: true }));
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Could not log time");
    }
  }

  async function handleEditSubmit() {
    if (!editState.id) return;
    if (editState.hours < 0.25 || editState.hours > 24) {
      toast.error("Hours must be between 0.25 and 24");
      return;
    }
    setSubmitting(true);
    const res = await updateTimeLog({
      id: editState.id,
      hours: editState.hours,
      description: editState.description.trim() || null,
      isBillable: editState.isBillable,
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Time entry updated");
      setEditState((s) => ({ ...s, open: false }));
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Could not update entry");
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    const res = await deleteTimeLog(id);
    setDeletingId(null);
    if (res.ok) {
      toast.success("Time entry deleted");
      router.refresh();
    } else {
      toast.error(typeof res.error === "string" ? res.error : "Could not delete entry");
    }
  }

  return (
    <div dir="ltr" lang="en" className="space-y-4">
      <WorkspaceNav projects={projects} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Timesheet</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateQuery({ weekStart: format(addWeeks(weekStartDate, -1), "yyyy-MM-dd"), teamMemberId: selectedTeamMemberId })}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous week
          </Button>
          <div className="rounded-md border px-3 py-1.5 text-sm font-medium">{weekRangeLabel}</div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => updateQuery({ weekStart: format(addWeeks(weekStartDate, 1), "yyyy-MM-dd"), teamMemberId: selectedTeamMemberId })}
          >
            Next week
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedTeamMemberId ?? "all"}
          onValueChange={(v) => updateQuery({ teamMemberId: v === "all" ? undefined : v })}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="All team members" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All team members</SelectItem>
            {teamMembers.map((m) => (
              <SelectItem key={m.id} value={m.id} textValue={m.name}>
                <TeamMemberSelectOptionRow avatarUrl={m.avatarUrl} name={m.name} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-7">
        {weekDays.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const entries = byDay[key] ?? [];
          const total = dailyTotals[key] ?? 0;
          return (
            <Card key={key} className="gap-3 py-4">
              <CardHeader className="px-4 pb-0">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{format(day, "EEE d MMM", { locale: enUS })}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 px-2"
                    onClick={() =>
                      setAddState({
                        open: true,
                        day: key,
                        taskId: "",
                        hours: 1,
                        description: "",
                        isBillable: true,
                      })
                    }
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-4">
                {entries.length === 0 ? (
                  <p className="text-muted-foreground text-xs">No entries</p>
                ) : (
                  entries.map((e) => {
                    const h = Number(e.hours ?? 0);
                    const title = e.task?.title ?? "Task";
                    const project = e.task?.project?.name ?? "Project";
                    return (
                      <button
                        type="button"
                        key={e.id}
                        className="w-full rounded-md border p-2 text-left hover:bg-muted/40"
                        onClick={() =>
                          setEditState({
                            open: true,
                            id: e.id,
                            taskTitle: title,
                            projectName: project,
                            hours: Number.isFinite(h) ? h : 0,
                            description: e.description ?? "",
                            isBillable: e.isBillable !== false,
                          })
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-medium">{title}</p>
                          <span className="inline-flex items-center gap-1 text-xs font-medium">
                            <Clock className="h-3.5 w-3.5" />
                            {fmtHours(Number.isFinite(h) ? h : 0)}
                          </span>
                        </div>
                        <p className="text-muted-foreground truncate text-xs">{project}</p>
                        {e.description ? (
                          <p className="mt-1 line-clamp-2 text-xs">{e.description}</p>
                        ) : null}
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-muted-foreground text-[11px]">
                            {e.isBillable ? "Billable" : "Non-billable"}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              void handleDelete(e.id);
                            }}
                            disabled={deletingId === e.id}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </button>
                    );
                  })
                )}
                <div className="border-t pt-2 text-right text-xs font-semibold">Daily total: {fmtHours(total)}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="gap-2 py-4">
        <CardContent className="px-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Week total</span>
            <span className="text-lg font-bold">{fmtHours(weekTotal)}</span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addState.open} onOpenChange={(open) => setAddState((s) => ({ ...s, open }))}>
        <DialogContent dir="ltr" lang="en">
          <DialogHeader className="text-left">
            <DialogTitle>Add time entry</DialogTitle>
            <DialogDescription>{format(parseISO(`${addState.day}T12:00:00`), "EEEE, MMM d, yyyy", { locale: enUS })}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Task</Label>
              <Select value={addState.taskId} onValueChange={(v) => setAddState((s) => ({ ...s, taskId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select task" />
                </SelectTrigger>
                <SelectContent>
                  {tasks.map((t) => (
                    <SelectItem
                      key={t.id}
                      value={t.id}
                      textValue={`${t.title} ${t.projectName}`}
                    >
                      <div className="flex min-w-0 items-start gap-2 py-0.5">
                        <ProjectSelectThumb
                          coverImageUrl={t.projectCoverImageUrl}
                          clientLogoUrl={t.projectClientLogoUrl}
                          fallbackName={t.projectName}
                          className="mt-0.5 h-5 w-5"
                        />
                        <span className="min-w-0 text-start text-sm leading-tight">
                          <span className="block truncate font-medium">{t.title}</span>
                          <span className="text-muted-foreground block truncate text-xs">{t.projectName}</span>
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hours</Label>
              <Input
                type="number"
                step={0.25}
                min={0.25}
                max={24}
                value={addState.hours}
                onChange={(e) => setAddState((s) => ({ ...s, hours: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                className="min-h-[80px]"
                value={addState.description}
                onChange={(e) => setAddState((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={addState.isBillable}
                onCheckedChange={(v) => setAddState((s) => ({ ...s, isBillable: v === true }))}
              />
              <Label className="font-normal">Billable</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddState((s) => ({ ...s, open: false }))}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddSubmit()} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editState.open} onOpenChange={(open) => setEditState((s) => ({ ...s, open }))}>
        <DialogContent dir="ltr" lang="en">
          <DialogHeader className="text-left">
            <DialogTitle>Edit time entry</DialogTitle>
            <DialogDescription>
              {editState.taskTitle} — {editState.projectName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Hours</Label>
              <Input
                type="number"
                step={0.25}
                min={0.25}
                max={24}
                value={editState.hours}
                onChange={(e) => setEditState((s) => ({ ...s, hours: Number(e.target.value || 0) }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                className="min-h-[80px]"
                value={editState.description}
                onChange={(e) => setEditState((s) => ({ ...s, description: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={editState.isBillable}
                onCheckedChange={(v) => setEditState((s) => ({ ...s, isBillable: v === true }))}
              />
              <Label className="font-normal">Billable</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditState((s) => ({ ...s, open: false }))}>
              Cancel
            </Button>
            <Button onClick={() => void handleEditSubmit()} disabled={submitting}>
              {submitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

