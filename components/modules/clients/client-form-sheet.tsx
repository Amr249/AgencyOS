"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient, updateClient, type CreateClientInput } from "@/actions/clients";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { clients } from "@/lib/db/schema";

const formSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  status: z.enum(["lead", "active", "on_hold", "completed", "closed"]),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  contactPhone: z.string().min(1, "Phone is required"),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type ClientRow = typeof clients.$inferSelect;

type ClientFormSheetProps = {
  trigger?: React.ReactNode;
  client?: ClientRow;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  asChild?: boolean;
};

export function ClientFormSheet({
  trigger,
  client,
  open,
  onOpenChange,
  asChild,
}: ClientFormSheetProps) {
  const isEdit = !!client;
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const effectiveOpen = isControlled ? open : dialogOpen;
  const setEffectiveOpen = isControlled ? onOpenChange : setDialogOpen;

  const [logoUploading, setLogoUploading] = React.useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      companyName: client?.companyName ?? "",
      status: client?.status ?? "lead",
      contactName: client?.contactName ?? "",
      contactEmail: client?.contactEmail ?? "",
      contactPhone: client?.contactPhone ?? "",
      website: client?.website ?? "",
      logoUrl: client?.logoUrl ?? "",
      notes: client?.notes ?? "",
    },
  });

  React.useEffect(() => {
    if (effectiveOpen && client) {
      form.reset({
        companyName: client.companyName,
        status: client.status,
        contactName: client.contactName ?? "",
        contactEmail: client.contactEmail ?? "",
        contactPhone: client.contactPhone ?? "",
        website: client.website ?? "",
        logoUrl: client.logoUrl ?? "",
        notes: client.notes ?? "",
      });
    } else if (effectiveOpen && !client) {
      form.reset({
        companyName: "",
        status: "lead",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        website: "",
        logoUrl: "",
        notes: "",
      });
    }
  }, [effectiveOpen, client, form]);

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("scope", "client-logo");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      if (data.url) form.setValue("logoUrl", data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo upload failed");
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    if (isEdit && client) {
      const result = await updateClient({
        id: client.id,
        companyName: values.companyName,
        status: values.status,
        contactName: values.contactName || undefined,
        contactEmail: values.contactEmail || undefined,
        contactPhone: values.contactPhone || undefined,
        website: values.website || undefined,
        logoUrl: values.logoUrl || undefined,
        notes: values.notes || undefined,
      });
      if (result.ok) {
        toast.success("Client updated");
        setEffectiveOpen(false);
      } else {
        const err = result.error as { _form?: string[] };
        const msg = err._form?.[0] ?? "Failed to update";
        toast.error(msg);
      }
    } else {
      const result = await createClient({
        companyName: values.companyName,
        status: values.status,
        contactName: values.contactName || undefined,
        contactEmail: values.contactEmail || undefined,
        contactPhone: values.contactPhone || undefined,
        website: values.website || undefined,
        logoUrl: values.logoUrl || undefined,
        notes: values.notes || undefined,
      } as CreateClientInput);
      if (result.ok) {
        toast.success("Client created");
        setEffectiveOpen(false);
      } else {
        const err = result.error as { _form?: string[] };
        const msg = err._form?.[0] ?? "Failed to create";
        toast.error(msg);
      }
    }
  }

  const content = (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? "تعديل العميل" : "عميل جديد"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "تحديث بيانات العميل أدناه."
            : "إضافة عميل جديد. الحقول المطلوبة معلمة."}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الشركة *</FormLabel>
                <FormControl>
                  <Input placeholder="اسم الشركة" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الحالة</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="lead">عميل محتمل</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="on_hold">متوقف</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                    <SelectItem value="closed">مغلق</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>جهة الاتصال</FormLabel>
                <FormControl>
                  <Input placeholder="الاسم" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>البريد الإلكتروني (اختياري)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="email@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contactPhone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الهاتف *</FormLabel>
                <FormControl>
                  <Input placeholder="رقم الهاتف" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="website"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الموقع (اختياري)</FormLabel>
                <FormControl>
                  <Input placeholder="https://..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="logoUrl"
            render={() => (
              <FormItem>
                <FormLabel>الشعار (اختياري)</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-3">
                    <Input
                      type="file"
                      accept="image/*"
                      className="cursor-pointer"
                      disabled={logoUploading}
                      onChange={onLogoChange}
                    />
                    {form.watch("logoUrl") && (
                      <img
                        src={form.watch("logoUrl")}
                        alt="Logo preview"
                        className="h-10 w-10 rounded object-cover"
                      />
                    )}
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ملاحظات</FormLabel>
                <FormControl>
                  <Textarea placeholder="ملاحظات داخلية..." className="resize-none" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEffectiveOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit">{isEdit ? "حفظ التغييرات" : "إنشاء عميل"}</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );

  const dialogContent = (
    <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
      {content}
    </DialogContent>
  );

  if (isControlled) {
    return (
      <Dialog open={effectiveOpen} onOpenChange={setEffectiveOpen}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={effectiveOpen} onOpenChange={setEffectiveOpen}>
      {trigger && (
        <DialogTrigger asChild={asChild}>
          {trigger}
        </DialogTrigger>
      )}
      {dialogContent}
    </Dialog>
  );
}
