"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createProject, type CreateProjectInput } from "@/actions/projects";
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
import { format } from "date-fns";
import { DatePickerAr } from "@/components/ui/date-picker-ar";

const projectStatusOptions = [
  { value: "lead", label: "عميل محتمل" },
  { value: "active", label: "نشط" },
  { value: "on_hold", label: "متوقف" },
  { value: "review", label: "مراجعة" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled", label: "ملغي" },
];

const formSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientId: z.string().uuid("Select a client"),
  status: z.enum(["lead", "active", "on_hold", "review", "completed", "cancelled"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  budget: z.coerce.number().min(0).optional(),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

type ClientOption = { id: string; companyName: string | null };

type NewProjectDialogProps = {
  trigger?: React.ReactNode;
  clients: ClientOption[];
  defaultCurrency?: string;
  /** When set, client is pre-selected and locked (e.g. from client detail page). */
  defaultClientId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  asChild?: boolean;
  onSuccess?: () => void;
};

export function NewProjectDialog({
  trigger,
  clients,
  defaultCurrency = "USD",
  defaultClientId,
  open,
  onOpenChange,
  asChild,
  onSuccess,
}: NewProjectDialogProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [coverImageUrl, setCoverImageUrl] = React.useState<string | null>(null);
  const [coverUploading, setCoverUploading] = React.useState(false);
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const effectiveOpen = isControlled ? open : dialogOpen;
  const setEffectiveOpen = isControlled ? onOpenChange : setDialogOpen;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      clientId: "",
      status: "lead",
      startDate: "",
      endDate: "",
      budget: undefined,
      description: "",
    },
  });

  const lockedClient = !!defaultClientId;
  React.useEffect(() => {
    if (effectiveOpen && !form.formState.isDirty) {
      setCoverImageUrl(null);
      form.reset({
        name: "",
        clientId: defaultClientId ?? "",
        status: "lead",
        startDate: "",
        endDate: "",
        budget: undefined,
        description: "",
      });
    }
  }, [effectiveOpen, form, defaultClientId]);

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("scope", "project-cover");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setCoverImageUrl(data.url);
      } else {
        toast.error(data.error ?? "Upload failed");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setCoverUploading(false);
      e.target.value = "";
    }
  };

  async function onSubmit(values: FormValues) {
    const result = await createProject({
      name: values.name,
      clientId: values.clientId,
      status: values.status,
      coverImageUrl: coverImageUrl ?? undefined,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
      budget: values.budget,
      description: values.description || undefined,
    } as CreateProjectInput);
    if (result.ok) {
      toast.success("تم إنشاء المشروع");
      setEffectiveOpen(false);
      onSuccess?.();
    } else {
      const err = result.error as { _form?: string[] } | Record<string, string[]>;
      const msg = err._form?.[0] ?? Object.values(err ?? {}).flat().find(Boolean) ?? "Failed to create project";
      toast.error(String(msg));
    }
  }

  const content = (
    <>
      <DialogHeader>
        <DialogTitle>مشروع جديد</DialogTitle>
        <DialogDescription>
          إضافة مشروع جديد مرتبط بعميل. الحقول المطلوبة معلمة.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">صورة غلاف المشروع (اختياري)</label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
              disabled={coverUploading}
            />
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
              >
                {coverUploading ? "جاري الرفع…" : coverImageUrl ? "استبدال الصورة" : "رفع غلاف"}
              </Button>
              {coverImageUrl && (
                <>
                  <img src={coverImageUrl} alt="Cover preview" className="h-14 w-14 rounded object-cover border" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCoverImageUrl(null)}>
                    إزالة
                  </Button>
                </>
              )}
            </div>
          </div>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>اسم المشروع *</FormLabel>
                <FormControl>
                  <Input placeholder="اسم المشروع" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>العميل *</FormLabel>
                {lockedClient ? (
                  <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground">
                    {clients.find((c) => c.id === field.value)?.companyName ?? field.value}
                  </div>
                ) : (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر العميل" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName || c.id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {projectStatusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تاريخ البدء</FormLabel>
                  <FormControl>
                    <DatePickerAr
                      value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                      onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      placeholder="اختر تاريخًا"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>تاريخ الانتهاء / الموعد النهائي</FormLabel>
                  <FormControl>
                    <DatePickerAr
                      value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                      onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      placeholder="اختر تاريخًا"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="budget"
            render={({ field }) => (
              <FormItem>
                <FormLabel>الميزانية (ر.س)</FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" placeholder="0" {...field} />
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
                <FormLabel>الوصف</FormLabel>
                <FormControl>
                  <Textarea placeholder="نطاق وأهداف المشروع..." className="resize-none" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEffectiveOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit">إنشاء المشروع</Button>
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
