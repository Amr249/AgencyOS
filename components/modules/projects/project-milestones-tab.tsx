"use client";

import * as React from "react";
import { toast } from "sonner";
import { Diamond, Plus } from "lucide-react";
import { format } from "date-fns";
import {
  createMilestone,
  deleteMilestone,
  completeMilestone,
  updateMilestone,
} from "@/actions/milestones";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

type MilestoneStatus = "pending" | "in_progress" | "completed" | "cancelled";

type TaskProgress = { total: number; completed: number; percent: number };

type MilestoneAssignee = {
  teamMemberId: string;
  name: string;
  avatarUrl: string | null;
};

type MilestoneRow = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  startDate: string;
  dueDate: string;
  status: MilestoneStatus;
  taskProgress?: TaskProgress;
  assignees: MilestoneAssignee[];
};

export type ProjectTeamMemberOption = {
  teamMemberId: string;
  memberName: string;
  memberAvatarUrl: string | null;
};

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_CLASS: Record<MilestoneStatus, string> = {
  pending: "bg-neutral-100 text-neutral-700 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-200",
  completed: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-200",
};

function fmtDay(d: Date | string): string {
  if (typeof d === "string") return d.length >= 10 ? d.slice(0, 10) : d;
  return d.toISOString().slice(0, 10);
}

function parseIsoDay(s: string): Date | undefined {
  if (!s || s.length < 10) return undefined;
  const d = new Date(`${s.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Calendar dates as YYYY-MM-DD in the user's local calendar (avoids UTC off-by-one vs toISOString). */
function toIsoDay(d: Date | undefined): string {
  if (!d) return "";
  return format(d, "yyyy-MM-dd");
}

function formatMilestoneError(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const values = Object.values(error as Record<string, string[] | string | undefined>).flatMap(
      (v) => (Array.isArray(v) ? v : v != null ? [String(v)] : [])
    );
    if (values.length) return values.join(" ");
  }
  return "Something went wrong.";
}

type FormState = {
  id?: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: MilestoneStatus;
  teamMemberIds: string[];
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  startDate: "",
  endDate: "",
  status: "pending",
  teamMemberIds: [],
};

function assigneesFromIds(
  ids: string[],
  team: ProjectTeamMemberOption[]
): MilestoneAssignee[] {
  return ids.map((teamMemberId) => {
    const row = team.find((t) => t.teamMemberId === teamMemberId);
    return {
      teamMemberId,
      name: row?.memberName ?? "Member",
      avatarUrl: row?.memberAvatarUrl ?? null,
    };
  });
}

export function ProjectMilestonesTab({
  projectId,
  initialMilestones,
  projectTeamMembers,
}: {
  projectId: string;
  initialMilestones: MilestoneRow[];
  projectTeamMembers: ProjectTeamMemberOption[];
}) {
  const [items, setItems] = React.useState(initialMilestones);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const sorted = React.useMemo(
    () => [...items].sort((a, b) => fmtDay(a.startDate).localeCompare(fmtDay(b.startDate))),
    [items]
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (m: MilestoneRow) => {
    setForm({
      id: m.id,
      name: m.name,
      description: m.description ?? "",
      startDate: fmtDay(m.startDate),
      endDate: fmtDay(m.dueDate),
      status: m.status,
      teamMemberIds: m.assignees.map((a) => a.teamMemberId),
    });
    setDialogOpen(true);
  };

  const toggleTeamMember = (teamMemberId: string, checked: boolean) => {
    setForm((p) => ({
      ...p,
      teamMemberIds: checked
        ? [...new Set([...p.teamMemberIds, teamMemberId])]
        : p.teamMemberIds.filter((id) => id !== teamMemberId),
    }));
  };

  const onSubmit = async () => {
    if (!form.name.trim() || !form.startDate || !form.endDate) {
      toast.error("Name, start date, and end date are required.");
      return;
    }
    if (form.startDate > form.endDate) {
      toast.error("End date must be on or after the start date.");
      return;
    }
    setSaving(true);
    try {
      if (form.id) {
        const res = await updateMilestone({
          id: form.id,
          name: form.name.trim(),
          description: form.description.trim() || null,
          startDate: form.startDate,
          dueDate: form.endDate,
          status: form.status,
          teamMemberIds: form.teamMemberIds,
        });
        if (!res.ok) {
          toast.error(formatMilestoneError(res.error));
          return;
        }
        setItems((prev) =>
          prev.map((m) =>
            m.id === form.id
              ? {
                  ...m,
                  ...res.data,
                  startDate: fmtDay(res.data.startDate),
                  dueDate: fmtDay(res.data.dueDate),
                  taskProgress: m.taskProgress ?? { total: 0, completed: 0, percent: 0 },
                  assignees: assigneesFromIds(form.teamMemberIds, projectTeamMembers),
                }
              : m
          )
        );
        toast.success("Milestone updated.");
      } else {
        const res = await createMilestone({
          projectId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          startDate: form.startDate,
          dueDate: form.endDate,
          status: form.status,
          teamMemberIds: form.teamMemberIds,
        });
        if (!res.ok) {
          toast.error(formatMilestoneError(res.error));
          return;
        }
        const row = res.data;
        setItems((prev) => [
          ...prev,
          {
            id: row.id,
            projectId: row.projectId,
            name: row.name,
            description: row.description,
            startDate: fmtDay(row.startDate),
            dueDate: fmtDay(row.dueDate),
            status: row.status as MilestoneStatus,
            taskProgress: { total: 0, completed: 0, percent: 0 },
            assignees: assigneesFromIds(form.teamMemberIds, projectTeamMembers),
          },
        ]);
        toast.success("Milestone created.");
      }
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    } catch (e) {
      console.error("Milestone save failed:", e);
      toast.error(
        e instanceof Error ? e.message : "Could not save the milestone. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteId) return;
    const res = await deleteMilestone(deleteId);
    if (!res.ok) {
      toast.error(typeof res.error === "string" ? res.error : "Failed to delete milestone.");
      return;
    }
    setItems((prev) => prev.filter((m) => m.id !== deleteId));
    setDeleteId(null);
    toast.success("Milestone deleted.");
  };

  const onMarkComplete = async (id: string) => {
    const res = await completeMilestone(id);
    if (!res.ok) {
      toast.error(typeof res.error === "string" ? res.error : "Failed to mark milestone complete.");
      return;
    }
    setItems((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: "completed" as const } : m))
    );
    toast.success("Milestone marked as complete.");
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4" dir="ltr" lang="en">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Milestones</h3>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Milestone
        </Button>
      </div>

      {sorted.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No milestones yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((m) => {
            const end = fmtDay(m.dueDate);
            const overdue = end < today && !["completed", "cancelled"].includes(m.status);
            return (
              <Card
                key={m.id}
                className={cn("text-left", overdue && "border-red-500/50 bg-red-50/30 dark:bg-red-950/10")}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="inline-flex items-center gap-2">
                      <Diamond className={cn("h-4 w-4", overdue ? "text-red-500" : "text-muted-foreground")} />
                      {m.name}
                    </span>
                    <span
                      className={cn(
                        "rounded border px-2 py-0.5 text-xs font-medium",
                        STATUS_CLASS[m.status]
                      )}
                    >
                      {STATUS_LABELS[m.status]}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <p>
                      <span className="text-muted-foreground">Start: </span>
                      <span className="tabular-nums">{fmtDay(m.startDate)}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">End: </span>
                      <span className={cn("tabular-nums", overdue && "font-medium text-red-600 dark:text-red-400")}>
                        {end}
                      </span>
                    </p>
                    <div className="sm:col-span-2">
                      <span className="text-muted-foreground text-sm">Team on this milestone</span>
                      {m.assignees.length === 0 ? (
                        <p className="text-muted-foreground mt-1 text-sm">—</p>
                      ) : (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {m.assignees.map((a) => (
                            <span
                              key={a.teamMemberId}
                              className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs"
                            >
                              <Avatar className="size-5">
                                <AvatarImage src={a.avatarUrl ?? undefined} alt="" />
                                <AvatarFallback className="text-[10px]">
                                  {a.name.slice(0, 1)}
                                </AvatarFallback>
                              </Avatar>
                              {a.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {m.description ? <p className="text-sm text-muted-foreground">{m.description}</p> : null}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Linked tasks</span>
                      <span className="font-medium tabular-nums">
                        {(m.taskProgress?.completed ?? 0)} / {(m.taskProgress?.total ?? 0)} done
                      </span>
                    </div>
                    <Progress value={m.taskProgress?.percent ?? 0} className="h-2" />
                    <p className="text-muted-foreground text-xs">
                      {(m.taskProgress?.total ?? 0) === 0
                        ? "No tasks linked yet — assign tasks from the task detail modal."
                        : `${m.taskProgress?.percent ?? 0}% of linked tasks complete`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(m)}>
                      Edit
                    </Button>
                    {m.status !== "completed" ? (
                      <Button size="sm" onClick={() => void onMarkComplete(m.id)}>
                        Mark as complete
                      </Button>
                    ) : null}
                    <Button variant="destructive" size="sm" onClick={() => setDeleteId(m.id)}>
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="ltr" lang="en" className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit milestone" : "Add milestone"}</DialogTitle>
            <DialogDescription>Set the time window and who is working on this milestone.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Milestone name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional details"
                rows={3}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium">Start date</label>
                <DatePickerAr
                  value={parseIsoDay(form.startDate)}
                  onChange={(d) => setForm((p) => ({ ...p, startDate: toIsoDay(d) }))}
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">End date</label>
                <DatePickerAr
                  value={parseIsoDay(form.endDate)}
                  onChange={(d) => setForm((p) => ({ ...p, endDate: toIsoDay(d) }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((p) => ({ ...p, status: v as MilestoneStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Team members</label>
              {projectTeamMembers.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Add people to this project on the Team tab first.
                </p>
              ) : (
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-3">
                  {projectTeamMembers.map((tm) => (
                    <label
                      key={tm.teamMemberId}
                      className="flex cursor-pointer items-center gap-3 text-sm"
                    >
                      <Checkbox
                        checked={form.teamMemberIds.includes(tm.teamMemberId)}
                        onCheckedChange={(c) => toggleTeamMember(tm.teamMemberId, c === true)}
                      />
                      <Avatar className="size-7">
                        <AvatarImage src={tm.memberAvatarUrl ?? undefined} alt="" />
                        <AvatarFallback className="text-xs">{tm.memberName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <span>{tm.memberName}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void onSubmit()} disabled={saving}>
              {form.id ? "Save Changes" : "Create Milestone"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent dir="ltr" lang="en">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete milestone?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void onDelete()}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
