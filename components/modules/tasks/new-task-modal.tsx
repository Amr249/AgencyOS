"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createTask } from "@/actions/tasks";
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
import { TASK_STATUS_LABELS_EN, TASK_PRIORITY_LABELS_EN } from "@/types";
import {
  ProjectSelectOptionRow,
  TeamMemberSelectOptionRow,
} from "@/components/entity-select-option";

/** Radix Select reserves empty string; use a sentinel for "no assignee". */
const ASSIGNEE_NONE = "__none__";

const formSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  projectId: z.string().uuid("Select a project"),
  description: z.string().optional(),
  status: z.enum(["todo", "in_progress", "in_review", "done", "blocked"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assigneeId: z.string().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  estimatedHours: z.coerce.number().min(0).optional(),
});

type FormValues = z.infer<typeof formSchema>;

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
};

export function NewTaskModal({
  open,
  onOpenChange,
  projects,
  teamMembers = [],
  defaultStatus = "todo",
  defaultDueDate,
  onSuccess,
}: NewTaskModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      projectId: projects[0]?.id ?? "",
      description: "",
      status: defaultStatus,
      priority: "medium",
      assigneeId: "",
      startDate: "",
      dueDate: defaultDueDate ?? "",
      estimatedHours: undefined,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        title: "",
        projectId: projects[0]?.id ?? "",
        description: "",
        status: defaultStatus,
        priority: "medium",
        assigneeId: "",
        startDate: "",
        dueDate: defaultDueDate ?? "",
        estimatedHours: undefined,
      });
    }
  }, [open, defaultStatus, defaultDueDate, projects, form]);

  async function onSubmit(values: FormValues) {
    const result = await createTask({
      projectId: values.projectId,
      title: values.title,
      description: values.description || undefined,
      status: values.status,
      priority: values.priority,
      assigneeId: values.assigneeId || null,
      startDate: values.startDate || undefined,
      dueDate: values.dueDate || undefined,
      estimatedHours: values.estimatedHours,
    });
    if (result.ok) {
      toast.success("Task created");
      onOpenChange(false);
      onSuccess();
    } else {
      const err = result.error as Record<string, string[] | undefined>;
      const msg =
        (err._form?.[0] ?? Object.values(err).flat().filter(Boolean).join(", ")) ||
        "Could not create task";
      toast.error(msg);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="text-start sm:max-w-md" dir="ltr" lang="en">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Add a task to a project. Fields marked by validation must be filled.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="Task title" {...field} />
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
                  <FormLabel>Project</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent dir="ltr">
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional details" className="resize-none" {...field} />
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
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent dir="ltr">
                        {(["todo", "in_progress", "in_review", "done", "blocked"] as const).map((s) => (
                          <SelectItem key={s} value={s}>
                            {TASK_STATUS_LABELS_EN[s]}
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
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent dir="ltr">
                        {(["low", "medium", "high", "urgent"] as const).map((p) => (
                          <SelectItem key={p} value={p}>
                            {TASK_PRIORITY_LABELS_EN[p]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            {teamMembers.length > 0 && (
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
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <DatePickerAr
                        value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                        onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        placeholder="Pick date"
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
                    <FormLabel>Due date</FormLabel>
                    <FormControl>
                      <DatePickerAr
                        value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                        onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        placeholder="Pick date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="estimatedHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated hours</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Creating…" : "Create task"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
