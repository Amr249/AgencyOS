"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createTask } from "@/actions/tasks";
import { getMilestonesByProjectId, getMilestonesByProjectIdForAssignee } from "@/actions/milestones";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import {
  TASK_STATUS_LABELS_EN,
  TASK_PRIORITY_LABELS_EN,
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/types";
import { ProjectSelectOptionRow, TeamMemberSelectOptionRow } from "@/components/entity-select-option";

/** Radix Select reserves empty string; use a sentinel for "no assignee". */
const ASSIGNEE_NONE = "__none__";
const MILESTONE_NONE = "__no_milestone__";

type FormValues = {
  title: string;
  projectId: string;
  description?: string;
  status: "todo" | "in_progress" | "in_review" | "done" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  assigneeId?: string;
  milestoneId?: string;
  startDate?: string;
  dueDate?: string;
};

function buildFormSchema(memberView: boolean) {
  return z.object({
    title: z.string().min(1, memberView ? "عنوان المهمة مطلوب" : "Task title is required"),
    projectId: z.string().uuid(memberView ? "اختر مشروعاً صالحاً" : "Select a project"),
    description: z.string().optional(),
    status: z.enum(["todo", "in_progress", "in_review", "done", "blocked"]),
    priority: z.enum(["low", "medium", "high", "urgent"]),
    assigneeId: z.string().optional(),
    milestoneId: z.string().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
  });
}

type ProjectOption = {
  id: string;
  name: string;
  coverImageUrl?: string | null;
  clientLogoUrl?: string | null;
};
type TeamMemberOption = { id: string; name: string; avatarUrl?: string | null };

type NewTaskModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectOption[];
  teamMembers?: TeamMemberOption[];
  defaultStatus?: "todo" | "in_progress" | "in_review" | "done" | "blocked";
  defaultDueDate?: string;
  onSuccess: () => void;
  /** Member portal: Arabic UI, no assignee picker; task is assigned to the signed-in member on the server. */
  memberView?: boolean;
  /** Team member id for the current user (optional; server still enforces self-assign for members). */
  memberTeamMemberId?: string | null;
};

const AR = {
  title: "مهمة جديدة",
  description:
    "أضف مهمة إلى المشروع. سيتم تعيين المهمة تلقائياً إليك. املأ الحقول المطلوبة.",
  titleLabel: "العنوان",
  titlePh: "عنوان المهمة",
  project: "المشروع",
  projectPh: "اختر مشروعاً",
  milestone: "المعلم",
  milestonePh: "بدون معلم",
  milestoneLoading: "جاري تحميل المعالم…",
  milestoneEmpty: "لا معالم لهذا المشروع",
  descLabel: "الوصف",
  descPh: "تفاصيل اختيارية",
  status: "الحالة",
  priority: "الأولوية",
  startDate: "تاريخ البدء",
  dueDate: "تاريخ الاستحقاق",
  datePh: "اختر التاريخ",
  cancel: "إلغاء",
  create: "إنشاء المهمة",
  creating: "جاري الإنشاء…",
  success: "تم إنشاء المهمة",
  errorGeneric: "تعذر إنشاء المهمة",
  forbidden: "غير مسموح",
  unauthorized: "غير مصرح",
};

function mapServerErrorToAr(msg: string): string {
  const m = msg.trim();
  if (m === "Forbidden") return AR.forbidden;
  if (m === "Not authorized") return AR.unauthorized;
  if (m === "You are not assigned to this milestone") {
    return "أنت غير معيَّن لهذا المعلم.";
  }
  return m;
}

export function NewTaskModal({
  open,
  onOpenChange,
  projects,
  teamMembers = [],
  defaultStatus = "todo",
  defaultDueDate,
  onSuccess,
  memberView = false,
  memberTeamMemberId = null,
}: NewTaskModalProps) {
  const formSchema = React.useMemo(() => buildFormSchema(memberView), [memberView]);
  const statusLabels = memberView ? TASK_STATUS_LABELS : TASK_STATUS_LABELS_EN;
  const priorityLabels = memberView ? TASK_PRIORITY_LABELS : TASK_PRIORITY_LABELS_EN;
  const selectDir = memberView ? "rtl" : "ltr";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      projectId: projects[0]?.id ?? "",
      description: "",
      status: defaultStatus,
      priority: "medium",
      assigneeId: memberView && memberTeamMemberId ? memberTeamMemberId : "",
      milestoneId: "",
      startDate: "",
      dueDate: defaultDueDate ?? "",
    },
  });

  const watchedProjectId = form.watch("projectId");
  const [milestoneRows, setMilestoneRows] = React.useState<
    { id: string; name: string; dueDate: string | null }[]
  >([]);
  const [milestonesLoading, setMilestonesLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open || !watchedProjectId) {
      setMilestoneRows([]);
      return;
    }
    if (memberView && !memberTeamMemberId) {
      setMilestoneRows([]);
      setMilestonesLoading(false);
      return;
    }
    let cancelled = false;
    setMilestonesLoading(true);
    const loader =
      memberView && memberTeamMemberId
        ? getMilestonesByProjectIdForAssignee(watchedProjectId, memberTeamMemberId)
        : getMilestonesByProjectId(watchedProjectId);

    loader.then((res) => {
      if (cancelled) return;
      setMilestonesLoading(false);
      if (res.ok) {
        setMilestoneRows(
          res.data.map((m) => ({
            id: m.id,
            name: m.name,
            dueDate: m.dueDate,
          }))
        );
      } else {
        setMilestoneRows([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, watchedProjectId, memberView, memberTeamMemberId]);

  React.useEffect(() => {
    if (milestonesLoading) return;
    const mid = form.getValues("milestoneId")?.trim();
    if (!mid) return;
    if (milestoneRows.length === 0 || !milestoneRows.some((r) => r.id === mid)) {
      form.setValue("milestoneId", "");
    }
  }, [milestoneRows, milestonesLoading, form]);

  React.useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        projectId: projects[0]?.id ?? "",
        description: "",
        status: defaultStatus,
        priority: "medium",
        assigneeId: memberView && memberTeamMemberId ? memberTeamMemberId : "",
        milestoneId: "",
        startDate: "",
        dueDate: defaultDueDate ?? "",
      });
    }
  }, [open, defaultStatus, defaultDueDate, projects, form, memberView, memberTeamMemberId]);

  async function onSubmit(values: FormValues) {
    const assigneeId =
      memberView && memberTeamMemberId ? memberTeamMemberId : values.assigneeId || null;
    const milestoneId = values.milestoneId?.trim() || undefined;
    const result = await createTask({
      projectId: values.projectId,
      title: values.title,
      description: values.description || undefined,
      status: values.status,
      priority: values.priority,
      assigneeId,
      milestoneId,
      startDate: values.startDate || undefined,
      dueDate: values.dueDate || undefined,
    });
    if (result.ok) {
      toast.success(memberView ? AR.success : "Task created");
      onOpenChange(false);
      onSuccess();
    } else {
      const err = result.error as Record<string, string[] | undefined>;
      const raw =
        (err._form?.[0] ?? Object.values(err).flat().filter(Boolean).join(", ")) ||
        (memberView ? AR.errorGeneric : "Could not create task");
      toast.error(memberView ? mapServerErrorToAr(raw) : raw);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="text-start sm:max-w-md"
        dir={memberView ? "rtl" : "ltr"}
        lang={memberView ? "ar" : "en"}
      >
        <DialogHeader>
          <DialogTitle>{memberView ? AR.title : "New task"}</DialogTitle>
          <DialogDescription>
            {memberView
              ? AR.description
              : "Add a task to a project. Fields marked by validation must be filled."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{memberView ? AR.titleLabel : "Title"}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={memberView ? AR.titlePh : "Task title"}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{memberView ? AR.project : "Project"}</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("milestoneId", "");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={memberView ? AR.projectPh : "Select project"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent dir={selectDir}>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id} textValue={p.name}>
                          <ProjectSelectOptionRow
                            coverImageUrl={p.coverImageUrl}
                            clientLogoUrl={p.clientLogoUrl}
                            name={p.name}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="milestoneId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{memberView ? AR.milestone : "Milestone"}</FormLabel>
                  <Select
                    disabled={!watchedProjectId || milestonesLoading}
                    onValueChange={(v) => field.onChange(v === MILESTONE_NONE ? "" : v)}
                    value={field.value ? field.value : MILESTONE_NONE}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            milestonesLoading
                              ? memberView
                                ? AR.milestoneLoading
                                : "Loading milestones…"
                              : memberView
                                ? AR.milestonePh
                                : "No milestone"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent dir={selectDir}>
                      <SelectItem
                        value={MILESTONE_NONE}
                        textValue={memberView ? AR.milestonePh : "No milestone"}
                      >
                        {memberView ? AR.milestonePh : "No milestone"}
                      </SelectItem>
                      {!milestonesLoading &&
                        milestoneRows.map((m) => (
                          <SelectItem key={m.id} value={m.id} textValue={m.name}>
                            <span className="flex flex-col gap-0.5 text-start">
                              <span>{m.name}</span>
                              {m.dueDate ? (
                                <span className="text-muted-foreground text-xs">
                                  {memberView ? `استحقاق ${m.dueDate}` : `Due ${m.dueDate}`}
                                </span>
                              ) : null}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {!milestonesLoading && milestoneRows.length === 0 && watchedProjectId ? (
                    <p className="text-muted-foreground text-xs">
                      {memberView ? AR.milestoneEmpty : "This project has no milestones yet."}
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{memberView ? AR.descLabel : "Description"}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={memberView ? AR.descPh : "Optional details"}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{memberView ? AR.status : "Status"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent dir={selectDir}>
                        {(["todo", "in_progress", "in_review", "done", "blocked"] as const).map(
                          (s) => (
                            <SelectItem key={s} value={s}>
                              {statusLabels[s] ?? TASK_STATUS_LABELS_EN[s]}
                            </SelectItem>
                          )
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{memberView ? AR.priority : "Priority"}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent dir={selectDir}>
                        {(["low", "medium", "high", "urgent"] as const).map((p) => (
                          <SelectItem key={p} value={p}>
                            {priorityLabels[p] ?? TASK_PRIORITY_LABELS_EN[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {!memberView && teamMembers.length > 0 && (
              <FormField
                control={form.control}
                name="assigneeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assignee</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === ASSIGNEE_NONE ? "" : v)}
                      value={field.value ? field.value : ASSIGNEE_NONE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent dir="ltr">
                        <SelectItem value={ASSIGNEE_NONE} textValue="Unassigned">
                          Unassigned
                        </SelectItem>
                        {teamMembers.map((m) => (
                          <SelectItem key={m.id} value={m.id} textValue={m.name}>
                            <TeamMemberSelectOptionRow avatarUrl={m.avatarUrl} name={m.name} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{memberView ? AR.startDate : "Start date"}</FormLabel>
                    <FormControl>
                      <DatePickerAr
                        value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                        onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        placeholder={memberView ? AR.datePh : "Pick date"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{memberView ? AR.dueDate : "Due date"}</FormLabel>
                    <FormControl>
                      <DatePickerAr
                        value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                        onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        placeholder={memberView ? AR.datePh : "Pick date"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className={memberView ? "flex-row-reverse gap-2 sm:justify-start" : undefined}>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {memberView ? AR.cancel : "Cancel"}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? memberView
                    ? AR.creating
                    : "Creating…"
                  : memberView
                    ? AR.create
                    : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
