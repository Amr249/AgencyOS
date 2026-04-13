"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { logTime } from "@/actions/time-tracking";
import type { DbErrorKey } from "@/lib/db-errors";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerAr } from "@/components/ui/date-picker-ar";

function isQuarterHour(h: number): boolean {
  return Number.isFinite(h) && Math.abs(h * 4 - Math.round(h * 4)) < 1e-6;
}

const formSchema = z.object({
  hours: z.coerce
    .number({ invalid_type_error: "Enter hours" })
    .min(0.25, "Minimum 0.25 hours")
    .max(24, "Maximum 24 hours")
    .refine(isQuarterHour, {
      message: "Use 0.25 hour increments (e.g. 0.25, 0.5, 1.25)",
    }),
  date: z.date({ required_error: "Select a date" }),
  description: z.string().max(2000).optional(),
  isBillable: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

function getDefaultValues(): FormValues {
  return {
    hours: 1,
    date: new Date(),
    description: "",
    isBillable: true,
  };
}

function formatLogError(error: unknown): string {
  if (error == null) return "Could not log time";
  if (typeof error === "string") {
    const keys: DbErrorKey[] = ["connectionTimeout", "fetchFailed", "unknown"];
    if (keys.includes(error as DbErrorKey)) {
      if (error === "connectionTimeout") return "Database connection timed out. Try again.";
      if (error === "fetchFailed") return "Network error. Try again.";
      return "Something went wrong.";
    }
    return error;
  }
  if (typeof error === "object") {
    const messages = Object.values(error as Record<string, unknown>)
      .flat()
      .filter((x): x is string => typeof x === "string");
    if (messages.length) return messages[0]!;
  }
  return "Could not log time";
}

export type LogTimeDialogProps = {
  taskId: string;
  teamMemberId?: string;
  onSuccess?: () => void;
  /** Must be a single element that accepts refs if using Radix `asChild` (e.g. Button). */
  trigger?: React.ReactNode;
};

export function LogTimeDialog({ taskId, teamMemberId, onSuccess, trigger }: LogTimeDialogProps) {
  const [open, setOpen] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(),
  });

  React.useEffect(() => {
    if (open) {
      form.reset(getDefaultValues());
    }
  }, [open, form]);

  async function onSubmit(values: FormValues) {
    const dateStr = format(values.date, "yyyy-MM-dd");
    const result = await logTime({
      taskId,
      hours: values.hours,
      date: dateStr,
      description: values.description?.trim() ? values.description.trim() : undefined,
      ...(teamMemberId ? { teamMemberId } : {}),
      isBillable: values.isBillable,
    });

    if (result.ok) {
      toast.success("Time logged");
      setOpen(false);
      onSuccess?.();
      return;
    }

    const err = result.error;
    if (typeof err === "object" && err !== null && !Array.isArray(err)) {
      const flat = err as Record<string, string[] | undefined>;
      let setFromServer = false;
      if (flat.hours?.[0]) {
        form.setError("hours", { message: flat.hours[0] });
        setFromServer = true;
      }
      if (flat.date?.[0]) {
        form.setError("date", { message: flat.date[0] });
        setFromServer = true;
      }
      if (setFromServer) return;
    }
    toast.error(formatLogError(err));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Log Time
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="ltr" lang="en">
        <DialogHeader className="text-left">
          <DialogTitle>Log time</DialogTitle>
          <DialogDescription>
            Add a manual time entry for this task (quarter-hour increments).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="hours"
              render={({ field }) => (
                <FormItem className="text-left">
                  <FormLabel>Hours</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step={0.25}
                      min={0.25}
                      max={24}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={Number.isFinite(field.value) ? field.value : ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "") {
                          field.onChange(Number.NaN);
                          return;
                        }
                        field.onChange(parseFloat(v));
                      }}
                    />
                  </FormControl>
                  <FormDescription>Min 0.25, max 24, steps of 0.25.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col text-left">
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <DatePickerAr
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Pick a date"
                      direction="ltr"
                      locale={enUS}
                      popoverAlign="start"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className="text-left">
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What did you work on?"
                      className="min-h-[80px] resize-y"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isBillable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 space-y-0 rounded-md border p-4 text-left">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-normal">Billable</FormLabel>
                    <FormDescription>Count this entry toward billable time.</FormDescription>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
