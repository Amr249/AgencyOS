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
import { ProjectSelectOptionRow, TeamMemberSelectOptionRow } from "@/components/entity-select-option";
import { useLocale, useTranslations } from "next-intl";

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

function buildFormSchema(messages: { titleRequired: string; projectInvalid: string }) {
  return z.object({
    title: z.string().min(1, messages.titleRequired),
    projectId: z.string().uuid(messages.projectInvalid),
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

function mapServerError(msg: string, tn: (key: string) => string): string {
  const m = msg.trim();
  if (m === "Forbidden") return tn("errors.forbidden");
  if (m === "Not authorized") return tn("errors.unauthorized");
  if (m === "You are not assigned to this milestone") return tn("errors.notAssignedMilestone");
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
  const appLocale = useLocale();
  const isAr = appLocale === "ar";
  const tn = useTranslations("newTaskModal");
  const tt = useTranslations("tasks");
  const formSchema = React.useMemo(
    () =>
      buildFormSchema({
        titleRequired: tn("validation.titleRequired"),
        projectInvalid: tn("validation.projectInvalid"),
      }),
    [tn]
  );
  const statusLabels = React.useMemo(
    () => ({
      todo: tt("taskStatusTodo"),
      in_progress: tt("taskStatusInProgress"),
      in_review: tt("taskStatusInReview"),
      done: tt("taskStatusDone"),
      blocked: tt("taskStatusBlocked"),
    }),
    [tt]
  );
  const priorityLabels = React.useMemo(
    () => ({
      low: tt("taskPrioLow"),
      medium: tt("taskPrioMedium"),
      high: tt("taskPrioHigh"),
      urgent: tt("taskPrioUrgent"),
    }),
    [tt]
  );
  const selectDir = isAr ? "rtl" : "ltr";

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
      toast.success(tn("successToast"));
      onOpenChange(false);
      onSuccess();
    } else {
      const err = result.error as Record<string, string[] | undefined>;
      const raw =
        (err._form?.[0] ?? Object.values(err).flat().filter(Boolean).join(", ")) ||
        tn("errors.createFailed");
      toast.error(isAr ? mapServerError(raw, tn) : raw);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="text-start sm:max-w-md"
        dir={isAr ? "rtl" : "ltr"}
        lang={isAr ? "ar" : "en"}
      >
        <DialogHeader>
          <DialogTitle>{tn("title")}</DialogTitle>
          <DialogDescription>
            {memberView ? tn("memberDescription") : tn("description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tn("taskTitleLabel")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={tn("taskTitlePlaceholder")}
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
                  <FormLabel>{tn("projectLabel")}</FormLabel>
                  <Select
                    onValueChange={(v) => {
                      field.onChange(v);
                      form.setValue("milestoneId", "");
                    }}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={tn("projectPlaceholder")} />
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
                  <FormLabel>{tn("milestoneLabel")}</FormLabel>
                  <Select
                    disabled={!watchedProjectId || milestonesLoading}
                    onValueChange={(v) => field.onChange(v === MILESTONE_NONE ? "" : v)}
                    value={field.value ? field.value : MILESTONE_NONE}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            milestonesLoading ? tn("milestoneLoading") : tn("milestonePlaceholder")
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent dir={selectDir}>
                      <SelectItem value={MILESTONE_NONE} textValue={tn("milestonePlaceholder")}>
                        {tn("milestonePlaceholder")}
                      </SelectItem>
                      {!milestonesLoading &&
                        milestoneRows.map((m) => (
                          <SelectItem key={m.id} value={m.id} textValue={m.name}>
                            <span className="flex flex-col gap-0.5 text-start">
                              <span>{m.name}</span>
                              {m.dueDate ? (
                                <span className="text-muted-foreground text-xs">
                                  {tn("milestoneDue", { date: m.dueDate })}
                                </span>
                              ) : null}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {!milestonesLoading && milestoneRows.length === 0 && watchedProjectId ? (
                    <p className="text-muted-foreground text-xs">
                      {tn("milestoneEmpty")}
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
                  <FormLabel>{tn("descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={tn("descriptionPlaceholder")}
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
                    <FormLabel>{tn("statusLabel")}</FormLabel>
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
                              {statusLabels[s]}
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
                    <FormLabel>{tn("priorityLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent dir={selectDir}>
                        {(["low", "medium", "high", "urgent"] as const).map((p) => (
                          <SelectItem key={p} value={p}>
                            {priorityLabels[p]}
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
                    <FormLabel>{tn("assigneeLabel")}</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === ASSIGNEE_NONE ? "" : v)}
                      value={field.value ? field.value : ASSIGNEE_NONE}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={tn("assigneePlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent dir={selectDir}>
                        <SelectItem value={ASSIGNEE_NONE} textValue={tn("unassigned")}>
                          {tn("unassigned")}
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
                    <FormLabel>{tn("startDateLabel")}</FormLabel>
                    <FormControl>
                      <DatePickerAr
                        value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                        onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        placeholder={tn("startDatePlaceholder")}
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
                    <FormLabel>{tn("dueDateLabel")}</FormLabel>
                    <FormControl>
                      <DatePickerAr
                        value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                        onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        placeholder={tn("dueDatePlaceholder")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className={isAr ? "flex-row-reverse gap-2 sm:justify-start" : undefined}>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tn("cancel")}
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? tn("submitting") : tn("submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
