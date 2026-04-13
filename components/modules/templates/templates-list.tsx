"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { ProjectTemplateListItem, ProjectTemplateWithTasks, TaskTemplateRow } from "@/actions/templates";
import {
  addTaskToTemplate,
  deleteProjectTemplate,
  deleteTaskTemplate,
  getTemplateById,
  reorderTaskTemplates,
  updateProjectTemplate,
  updateTaskTemplate,
} from "@/actions/templates";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

function phaseCount(template: Pick<ProjectTemplateWithTasks, "defaultPhases">) {
  const n = template.defaultPhases?.filter((p) => p.trim()).length ?? 0;
  return Math.max(n, 5);
}

function SortableTaskTemplateRow({
  task,
  maxPhaseIdx,
  onSave,
  onRemove,
}: {
  task: TaskTemplateRow;
  maxPhaseIdx: number;
  onSave: (patch: {
    title: string;
    description: string | null;
    estimatedHours: number | null;
    priority: (typeof PRIORITIES)[number];
    phaseIndex: number;
  }) => Promise<void>;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [title, setTitle] = React.useState(task.title);
  const [description, setDescription] = React.useState(task.description ?? "");
  const [hours, setHours] = React.useState(task.estimatedHours ? String(task.estimatedHours) : "");
  const [priority, setPriority] = React.useState<string>(task.priority);
  const [phaseIndex, setPhaseIndex] = React.useState(String(task.phaseIndex));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setTitle(task.title);
    setDescription(task.description ?? "");
    setHours(task.estimatedHours ? String(task.estimatedHours) : "");
    setPriority(task.priority);
    setPhaseIndex(String(task.phaseIndex));
  }, [task]);

  const save = async () => {
    setSaving(true);
    try {
      const h = hours.trim() === "" ? null : Number(hours);
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        estimatedHours: h != null && !Number.isNaN(h) && h >= 0 ? h : null,
        priority: priority as (typeof PRIORITIES)[number],
        phaseIndex: Math.min(maxPhaseIdx, Math.max(0, parseInt(phaseIndex, 10) || 0)),
      });
      toast.success("Task template saved");
    } catch {
      toast.error("Could not save task");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-card flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-end sm:gap-3",
        isDragging && "opacity-60 ring-2 ring-primary/30"
      )}
    >
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground mt-1 shrink-0 cursor-grab self-start active:cursor-grabbing"
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-5" />
      </button>
      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <div className="space-y-1 lg:col-span-2">
          <Label className="text-xs">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Phase index</Label>
          <Input
            type="number"
            min={0}
            max={maxPhaseIdx}
            value={phaseIndex}
            onChange={(e) => setPhaseIndex(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Priority</Label>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Est. hours</Label>
          <Input
            type="number"
            min={0}
            step={0.25}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="h-9"
            placeholder="—"
          />
        </div>
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label className="text-xs">Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-9" />
        </div>
      </div>
      <div className="flex shrink-0 gap-2 self-end sm:flex-col sm:self-stretch">
        <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void save()}>
          Save
        </Button>
        <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function TemplatesList({
  initialTemplates,
  loadError,
}: {
  initialTemplates: ProjectTemplateListItem[];
  loadError: string | null;
}) {
  const router = useRouter();
  const [templates, setTemplates] = React.useState(initialTemplates);
  React.useEffect(() => {
    setTemplates(initialTemplates);
  }, [initialTemplates]);

  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<ProjectTemplateWithTasks | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);

  const [tplName, setTplName] = React.useState("");
  const [tplDescription, setTplDescription] = React.useState("");
  const [tplPhasesText, setTplPhasesText] = React.useState("");
  const [tplBudget, setTplBudget] = React.useState("");
  const [savingTemplate, setSavingTemplate] = React.useState(false);

  const [newTaskTitle, setNewTaskTitle] = React.useState("");
  const [newTaskPhase, setNewTaskPhase] = React.useState("0");
  const [newTaskPriority, setNewTaskPriority] = React.useState<string>("medium");
  const [newTaskHours, setNewTaskHours] = React.useState("");
  const [addingTask, setAddingTask] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<ProjectTemplateListItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const [taskDeleteId, setTaskDeleteId] = React.useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const openSheet = async (id: string) => {
    setSheetOpen(true);
    setLoadingDetail(true);
    const res = await getTemplateById(id);
    setLoadingDetail(false);
    if (!res.ok) {
      toast.error(res.error);
      setSheetOpen(false);
      return;
    }
    setDetail(res.data);
    setTplName(res.data.name);
    setTplDescription(res.data.description ?? "");
    setTplPhasesText((res.data.defaultPhases ?? []).join("\n"));
    setTplBudget(res.data.defaultBudget ? String(res.data.defaultBudget) : "");
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setDetail(null);
    router.refresh();
  };

  const onSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setDetail(null);
      router.refresh();
    }
  };

  const saveTemplateMeta = async () => {
    if (!detail) return;
    setSavingTemplate(true);
    const phases = tplPhasesText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const budgetNum = tplBudget.trim() === "" ? null : Number(tplBudget);
    const res = await updateProjectTemplate({
      id: detail.id,
      name: tplName.trim(),
      description: tplDescription.trim() || null,
      defaultPhases: phases,
      defaultBudget: budgetNum != null && !Number.isNaN(budgetNum) ? budgetNum : null,
    });
    setSavingTemplate(false);
    if (!res.ok) {
      const msg =
        "error" in res && typeof res.error === "object"
          ? Object.values(res.error).flat().join(" ")
          : "Failed to save";
      toast.error(msg);
      return;
    }
    toast.success("Template updated");
    setDetail((d) => (d && res.ok ? { ...d, ...res.data, taskTemplates: d.taskTemplates } : d));
    router.refresh();
  };

  const onDragEnd = async (event: DragEndEvent) => {
    if (!detail) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = detail.taskTemplates.map((t) => t.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const nextOrder = arrayMove(detail.taskTemplates, oldIndex, newIndex);
    setDetail({ ...detail, taskTemplates: nextOrder });
    const r = await reorderTaskTemplates({
      projectTemplateId: detail.id,
      orderedIds: nextOrder.map((t) => t.id),
    });
    if (!r.ok) {
      toast.error("Could not reorder");
      void openSheet(detail.id);
      return;
    }
    toast.success("Order saved");
    router.refresh();
  };

  const saveTaskRow = async (
    taskId: string,
    patch: {
      title: string;
      description: string | null;
      estimatedHours: number | null;
      priority: (typeof PRIORITIES)[number];
      phaseIndex: number;
    }
  ) => {
    const res = await updateTaskTemplate({
      id: taskId,
      title: patch.title,
      description: patch.description,
      estimatedHours: patch.estimatedHours,
      priority: patch.priority,
      phaseIndex: patch.phaseIndex,
    });
    if (!res.ok) {
      const msg =
        "error" in res && typeof res.error === "object"
          ? Object.values(res.error).flat().join(" ")
          : "Failed";
      throw new Error(msg);
    }
    if (detail && res.ok) {
      setDetail({
        ...detail,
        taskTemplates: detail.taskTemplates.map((t) => (t.id === taskId ? { ...t, ...res.data } : t)),
      });
    }
    router.refresh();
  };

  const confirmDeleteTask = async () => {
    if (!taskDeleteId || !detail) return;
    const res = await deleteTaskTemplate(taskDeleteId);
    setTaskDeleteId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Task template removed");
    setDetail({
      ...detail,
      taskTemplates: detail.taskTemplates.filter((t) => t.id !== taskDeleteId),
    });
    router.refresh();
  };

  const addTask = async () => {
    if (!detail || !newTaskTitle.trim()) return;
    setAddingTask(true);
    const maxIdx = Math.max(0, phaseCount(detail) - 1);
    const pi = Math.min(maxIdx, Math.max(0, parseInt(newTaskPhase, 10) || 0));
    const h = newTaskHours.trim() === "" ? undefined : Number(newTaskHours);
    const res = await addTaskToTemplate({
      projectTemplateId: detail.id,
      title: newTaskTitle.trim(),
      estimatedHours: h != null && !Number.isNaN(h) ? h : undefined,
      priority: newTaskPriority as (typeof PRIORITIES)[number],
      phaseIndex: pi,
    });
    setAddingTask(false);
    if (!res.ok) {
      const msg =
        "error" in res && typeof res.error === "object"
          ? Object.values(res.error).flat().join(" ")
          : "Failed to add task";
      toast.error(msg);
      return;
    }
    setNewTaskTitle("");
    setNewTaskHours("");
    const full = await getTemplateById(detail.id);
    if (full.ok) setDetail(full.data);
    toast.success("Task template added");
    router.refresh();
  };

  const confirmDeleteTemplate = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await deleteProjectTemplate(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Template deleted");
    if (detail?.id === deleteTarget.id) closeSheet();
    router.refresh();
  };

  const maxPhaseIdx = detail ? Math.max(0, phaseCount(detail) - 1) : 0;

  return (
    <>
      {loadError ? (
        <p className="text-destructive text-sm">Could not load templates: {loadError}</p>
      ) : null}

      {templates.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No project templates yet. Create one from the codebase or save a project as a template.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead className="w-[100px] text-right">Tasks</TableHead>
                <TableHead className="hidden w-[140px] sm:table-cell">Created</TableHead>
                <TableHead className="w-[160px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground hidden max-w-[280px] truncate md:table-cell">
                    {t.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{t.taskCount}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                    {format(new Date(t.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => void openSheet(t.id)}>
                        <Pencil className="mr-1 size-3.5" />
                        View / Edit
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="text-destructive size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Sheet open={sheetOpen} onOpenChange={onSheetOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-xl" dir="ltr" lang="en">
          <SheetHeader>
            <SheetTitle>Edit template</SheetTitle>
            <SheetDescription>Update metadata, phases, and task templates.</SheetDescription>
          </SheetHeader>

          {loadingDetail ? (
            <p className="text-muted-foreground py-8 text-sm">Loading…</p>
          ) : detail ? (
            <div className="flex flex-1 flex-col gap-6 py-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="tpl-name">Name</Label>
                  <Input id="tpl-name" value={tplName} onChange={(e) => setTplName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tpl-desc">Description</Label>
                  <Textarea
                    id="tpl-desc"
                    value={tplDescription}
                    onChange={(e) => setTplDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tpl-phases">Phase names (one per line)</Label>
                  <Textarea
                    id="tpl-phases"
                    value={tplPhasesText}
                    onChange={(e) => setTplPhasesText(e.target.value)}
                    rows={5}
                    placeholder="Discovery&#10;Design&#10;..."
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tpl-budget">Default budget (optional)</Label>
                  <Input
                    id="tpl-budget"
                    type="number"
                    min={0}
                    step={0.01}
                    value={tplBudget}
                    onChange={(e) => setTplBudget(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <Button
                  type="button"
                  disabled={savingTemplate}
                  onClick={() => void saveTemplateMeta()}
                >
                  Save template details
                </Button>
              </div>

              <div className="border-t pt-4">
                <h3 className="mb-3 font-semibold">Task templates</h3>
                <p className="text-muted-foreground mb-3 text-xs">
                  Drag the handle to reorder. Phase index is 0-based (first phase = 0).
                </p>

                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext
                    items={detail.taskTemplates.map((x) => x.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-2">
                      {detail.taskTemplates.map((task) => (
                        <SortableTaskTemplateRow
                          key={task.id}
                          task={task}
                          maxPhaseIdx={maxPhaseIdx}
                          onSave={(patch) => saveTaskRow(task.id, patch)}
                          onRemove={() => setTaskDeleteId(task.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>

                <div className="mt-4 space-y-2 rounded-lg border border-dashed p-3">
                  <p className="text-sm font-medium">Add task template</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Title"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min={0}
                        max={maxPhaseIdx}
                        className="w-24"
                        value={newTaskPhase}
                        onChange={(e) => setNewTaskPhase(e.target.value)}
                        title="Phase index"
                      />
                      <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      step={0.25}
                      placeholder="Est. hours"
                      value={newTaskHours}
                      onChange={(e) => setNewTaskHours(e.target.value)}
                    />
                    <Button
                      type="button"
                      disabled={addingTask || !newTaskTitle.trim()}
                      onClick={() => void addTask()}
                    >
                      <Plus className="mr-1 size-4" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <SheetFooter className="mt-auto border-t pt-4">
            <Button type="button" variant="outline" onClick={() => closeSheet()}>
              Close
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent dir="ltr" lang="en">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{deleteTarget?.name}” and all of its task templates. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => void confirmDeleteTemplate()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!taskDeleteId} onOpenChange={(o) => !o && setTaskDeleteId(null)}>
        <AlertDialogContent dir="ltr" lang="en">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove task template?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeleteTask()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
