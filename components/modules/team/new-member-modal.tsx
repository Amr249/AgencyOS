"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createTeamMember, updateTeamMember, type CreateTeamMemberInput, type TeamMemberRow } from "@/actions/team";
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

const formSchema = z.object({
  name: z.string().min(1, "الاسم مطلوب"),
  role: z.string().optional(),
  email: z.string().email("بريد إلكتروني غير صالح").optional().or(z.literal("")),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const ROLE_SUGGESTIONS = ["مصمم", "مطور", "مدير مشروع", "محاسب", "أخرى"];

type NewMemberModalProps = {
  trigger: React.ReactNode;
  member?: TeamMemberRow | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  asChild?: boolean;
  onSuccess?: () => void;
};

export function NewMemberModal({
  trigger,
  member,
  open: openProp,
  onOpenChange: onOpenChangeProp,
  asChild,
  onSuccess,
}: NewMemberModalProps) {
  const [openLocal, setOpenLocal] = React.useState(false);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const isControlled = openProp !== undefined && onOpenChangeProp !== undefined;
  const open = isControlled ? openProp : openLocal;
  const setOpen = isControlled ? onOpenChangeProp! : setOpenLocal;
  const isEdit = !!member;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: member?.name ?? "",
      role: member?.role ?? "",
      email: member?.email ?? "",
      phone: member?.phone ?? "",
      avatarUrl: member?.avatarUrl ?? "",
      status: (member?.status as "active" | "inactive") ?? "active",
      notes: member?.notes ?? "",
    },
  });

  React.useEffect(() => {
    if (open && member) {
      form.reset({
        name: member.name,
        role: member.role ?? "",
        email: member.email ?? "",
        phone: member.phone ?? "",
        avatarUrl: member.avatarUrl ?? "",
        status: member.status as "active" | "inactive",
        notes: member.notes ?? "",
      });
    } else if (open && !member) {
      form.reset({
        name: "",
        role: "",
        email: "",
        phone: "",
        avatarUrl: "",
        status: "active",
        notes: "",
      });
    }
  }, [open, member, form]);

  const avatarUrl = form.watch("avatarUrl");

  const onAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("scope", "team-avatar");
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) form.setValue("avatarUrl", data.url);
      else toast.error("فشل رفع الصورة");
    } catch {
      toast.error("فشل رفع الصورة");
    } finally {
      setAvatarUploading(false);
    }
  };

  async function onSubmit(values: FormValues) {
    const payload: CreateTeamMemberInput = {
      name: values.name,
      role: values.role || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      avatarUrl: values.avatarUrl || null,
      status: values.status,
      notes: values.notes || undefined,
    };

    if (isEdit) {
      const result = await updateTeamMember({ id: member.id, ...payload });
      if (result.ok) {
        toast.success("تم تحديث العضو");
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(typeof result.error === "string" ? result.error : "فشل التحديث");
      }
    } else {
      const result = await createTeamMember(payload);
      if (result.ok) {
        toast.success("تمت إضافة العضو");
        setOpen(false);
        onSuccess?.();
      } else {
        const err = result.error as Record<string, string[] | undefined>;
        const msg = err?.name?.[0] ?? (typeof result.error === "string" ? result.error : "فشل الإضافة");
        toast.error(msg);
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild={asChild}>{trigger}</DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle>{isEdit ? "تعديل عضو الفريق" : "إضافة عضو جديد"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "تحديث بيانات العضو." : "أدخل بيانات العضو الجديد."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel>الاسم *</FormLabel>
                  <FormControl>
                    <Input placeholder="الاسم الكامل" className="text-right" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel>الدور</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="مصمم / مطور / مدير مشروع / محاسب / أخرى"
                      className="text-right"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel>البريد الإلكتروني</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@example.com" className="text-right" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel>الهاتف</FormLabel>
                  <FormControl>
                    <Input placeholder="رقم الهاتف" className="text-right" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel>الصورة الشخصية</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-3">
                      {avatarUrl && (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="h-14 w-14 rounded-full border object-cover"
                        />
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        className="cursor-pointer max-w-[200px]"
                        disabled={avatarUploading}
                        onChange={onAvatarChange}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel>الحالة</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="text-right">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="inactive">غير نشط</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="text-right">
                  <FormLabel>ملاحظات</FormLabel>
                  <FormControl>
                    <Textarea placeholder="ملاحظات اختيارية" className="text-right min-h-[80px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit">{isEdit ? "حفظ" : "إضافة"}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
