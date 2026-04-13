"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { saveProjectAsTemplate } from "@/actions/project-templates";
import { Button } from "@/components/ui/button";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { LayoutTemplate } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

type SaveProjectTemplateDialogProps = {
  projectId: string;
  defaultName?: string;
};

export function SaveProjectTemplateDialog({ projectId, defaultName }: SaveProjectTemplateDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: defaultName ?? "", description: "" },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ name: defaultName ?? "", description: "" });
    }
  }, [open, defaultName, form]);

  async function onSubmit(values: FormValues) {
    setPending(true);
    try {
      const result = await saveProjectAsTemplate(
        projectId,
        values.name.trim(),
        values.description?.trim() || null
      );
      if (!result.ok) {
        const msg =
          typeof result.error === "string"
            ? result.error
            : "Could not save template. Check the form.";
        toast.error(msg);
        return;
      }
      setOpen(false);
      toast.success("Template saved", {
        description: "Phases and task structure were copied (no dates, assignees, or time).",
        action: {
          label: "View template",
          onClick: () => router.push(`/dashboard/templates/${result.data.templateId}`),
        },
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm" className="gap-2">
          <LayoutTemplate className="size-4" />
          Save as template
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md" dir="ltr" lang="en">
        <DialogHeader>
          <DialogTitle>Save as template</DialogTitle>
          <DialogDescription>
            Creates a reusable blueprint from this project&apos;s phases and tasks. Dates, assignees,
            milestones, and time entries are not included.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Website launch" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="When to use this template…"
                      rows={3}
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save template"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
