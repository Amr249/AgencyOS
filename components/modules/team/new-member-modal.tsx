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
import { useLocale, useTranslations } from "next-intl";

type FormValues = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  status: "active" | "inactive";
  notes?: string;
};

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
  const t = useTranslations("team");
  const locale = useLocale();
  const pageDir = locale === "ar" ? "rtl" : "ltr";
  const [openLocal, setOpenLocal] = React.useState(false);
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const isControlled = openProp !== undefined && onOpenChangeProp !== undefined;
  const open = isControlled ? openProp : openLocal;
  const setOpen = isControlled ? onOpenChangeProp! : setOpenLocal;
  const isEdit = !!member;

  const formSchema = React.useMemo(
    () =>
      z.object({
        name: z.string().min(1, t("validationNameRequired")),
        role: z.string().optional(),
        email: z.string().email(t("validationEmailInvalid")).optional().or(z.literal("")),
        phone: z.string().optional(),
        avatarUrl: z.string().optional(),
        status: z.enum(["active", "inactive"]),
        notes: z.string().optional(),
      }),
    [t]
  );

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
      formData.set("entityId", member?.id ?? crypto.randomUUID());
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) form.setValue("avatarUrl", data.url);
      else toast.error(t("toastAvatarUploadFailed"));
    } catch {
      toast.error(t("toastAvatarUploadFailed"));
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
        toast.success(t("toastMemberUpdated"));
        setOpen(false);
        onSuccess?.();
      } else {
        toast.error(typeof result.error === "string" ? result.error : t("toastUpdateFailed"));
      }
    } else {
      const result = await createTeamMember(payload);
      if (result.ok) {
        toast.success(t("toastMemberAdded"));
        setOpen(false);
        onSuccess?.();
      } else {
        const err = result.error as Record<string, string[] | undefined>;
        const msg = err?.name?.[0] ?? (typeof result.error === "string" ? result.error : t("toastCreateFailed"));
        toast.error(msg);
      }
    }
  }

  const fieldAlign = pageDir === "rtl" ? "text-end" : "text-start";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild={asChild}>{trigger}</DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg" dir={pageDir}>
        <DialogHeader className={fieldAlign}>
          <DialogTitle>{isEdit ? t("modalEditTitle") : t("modalAddTitle")}</DialogTitle>
          <DialogDescription>{isEdit ? t("modalEditDescription") : t("modalAddDescription")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={fieldAlign}>
                  <FormLabel>{t("nameRequiredLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("placeholderFullName")} className={fieldAlign} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem className={fieldAlign}>
                  <FormLabel>{t("role")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("placeholderRole")} className={fieldAlign} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className={fieldAlign}>
                  <FormLabel>{t("email")}</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder={t("placeholderEmail")} className={fieldAlign} dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className={fieldAlign}>
                  <FormLabel>{t("phone")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("placeholderPhone")} className={fieldAlign} dir="ltr" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="avatarUrl"
              render={() => (
                <FormItem className={fieldAlign}>
                  <FormLabel>{t("avatar")}</FormLabel>
                  <FormControl>
                    <div className={`flex items-center gap-3 ${pageDir === "rtl" ? "flex-row-reverse" : ""}`}>
                      {avatarUrl && (
                        <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full border object-cover" />
                      )}
                      <Input
                        type="file"
                        accept="image/*"
                        className="max-w-[min(100%,220px)] cursor-pointer"
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
                <FormItem className={fieldAlign}>
                  <FormLabel>{t("status")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className={fieldAlign}>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent dir={pageDir}>
                      <SelectItem value="active">{t("active")}</SelectItem>
                      <SelectItem value="inactive">{t("inactive")}</SelectItem>
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
                <FormItem className={fieldAlign}>
                  <FormLabel>{t("notes")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t("placeholderNotes")} className={`min-h-[80px] ${fieldAlign}`} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className={pageDir === "rtl" ? "sm:flex-row-reverse sm:justify-start" : undefined}>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit">{isEdit ? t("save") : t("add")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
