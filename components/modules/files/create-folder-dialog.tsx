"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  name: z.string().min(1, "أدخل اسم المجلد").max(255),
});

type FormValues = z.infer<typeof schema>;

type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentFolderId: string | null;
  onSubmit: (name: string) => Promise<void> | void;
};

export function CreateFolderDialog({
  open,
  onOpenChange,
  parentFolderId: _parentFolderId,
  onSubmit,
}: CreateFolderDialogProps) {
  const [busy, setBusy] = React.useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({ name: "" });
    }
  }, [open, form]);

  const handleSubmit = form.handleSubmit(async (values) => {
    setBusy(true);
    try {
      await onSubmit(values.name.trim());
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle>مجلد جديد</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>اسم المجلد</FormLabel>
                  <FormControl>
                    <Input placeholder="مثال: العلامة التجارية" autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                إلغاء
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "جاري الإنشاء…" : "إنشاء"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
