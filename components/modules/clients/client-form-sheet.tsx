"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
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
import { useTranslateActionError } from "@/hooks/use-translate-action-error";
import { isDbErrorKey } from "@/lib/i18n-errors";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const formSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  status: z.enum(["lead", "active", "on_hold", "completed", "closed"]),
  contactName: z.string().optional(),
  contactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  contactPhone: z.string().min(1, "Phone is required"),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
  serviceIds: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof formSchema>;

type ClientRow = typeof clients.$inferSelect;

type ClientFormSheetProps = {
  trigger?: React.ReactNode;
  client?: ClientRow;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  asChild?: boolean;
  serviceOptions?: { id: string; name: string; status: string }[];
  initialServiceIds?: string[];
};

export function ClientFormSheet({
  trigger,
  client,
  open,
  onOpenChange,
  asChild,
  serviceOptions = [],
  initialServiceIds = [],
}: ClientFormSheetProps) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const translateErr = useTranslateActionError();
  const isEdit = !!client;
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const effectiveOpen = isControlled ? open : dialogOpen;
  const setEffectiveOpen = isControlled ? onOpenChange : setDialogOpen;

  const [logoUploading, setLogoUploading] = React.useState(false);
  const statusLabel = (status: FormValues["status"]) => {
    if (status === "lead") return t("statusLeadFull");
    if (status === "active") return tc("active");
    if (status === "on_hold") return t("statusOnHold");
    if (status === "completed") return tc("completed");
    return t("statusClosed");
  };
  const statusDotClass = (status: FormValues["status"]) => {
    if (status === "lead") return "bg-blue-500";
    if (status === "active") return "bg-green-500";
    if (status === "on_hold") return "bg-amber-500";
    if (status === "completed") return "bg-neutral-400";
    return "bg-red-500";
  };

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
      serviceIds: initialServiceIds,
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
        serviceIds: initialServiceIds,
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
        serviceIds: [],
      });
    }
  }, [effectiveOpen, client, form, initialServiceIds]);

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
        serviceIds: values.serviceIds ?? [],
      });
      if (result.ok) {
        toast.success(t("toastUpdated"));
        setEffectiveOpen(false);
      } else {
        const err = result.error as { _form?: string[] };
        const msg = err._form?.[0] ?? "Failed to update";
        toast.error(isDbErrorKey(msg) ? translateErr(msg) : msg);
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
        serviceIds: values.serviceIds ?? [],
      } as CreateClientInput);
      if (result.ok) {
        toast.success(t("toastCreated"));
        setEffectiveOpen(false);
      } else {
        const err = result.error as { _form?: string[] };
        const msg = err._form?.[0] ?? "Failed to create";
        toast.error(isDbErrorKey(msg) ? translateErr(msg) : msg);
      }
    }
  }

  const content = (
    <>
      <DialogHeader>
        <DialogTitle>{isEdit ? t("formEditTitle") : t("formNewTitle")}</DialogTitle>
        <DialogDescription>
          {isEdit ? t("formDescEdit") : t("formDescNew")}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <FormField
            control={form.control}
            name="companyName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("companyLabel")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("companyPlaceholder")} {...field} />
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
                <FormLabel>{tc("status")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="justify-start">
                      <SelectValue placeholder={t("statusPlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="lead">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-blue-500" aria-hidden />
                        {t("statusLeadFull")}
                      </span>
                    </SelectItem>
                    <SelectItem value="active">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
                        {tc("active")}
                      </span>
                    </SelectItem>
                    <SelectItem value="on_hold">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
                        {t("statusOnHold")}
                      </span>
                    </SelectItem>
                    <SelectItem value="completed">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-neutral-400" aria-hidden />
                        {tc("completed")}
                      </span>
                    </SelectItem>
                    <SelectItem value="closed">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
                        {t("statusClosed")}
                      </span>
                    </SelectItem>
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
                <FormLabel>{t("contact")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("contactNamePlaceholder")} {...field} />
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
                <FormLabel>{t("emailOptional")}</FormLabel>
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
                <FormLabel>{t("phoneLabel")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("phonePlaceholder")} {...field} />
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
                <FormLabel>{t("websiteOptional")}</FormLabel>
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
                <FormLabel>{t("logoOptional")}</FormLabel>
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
                <FormLabel>{t("notesLabel")}</FormLabel>
                <FormControl>
                  <Textarea placeholder={t("notesPlaceholder")} className="resize-none" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {serviceOptions.length > 0 && (
            <FormField
              control={form.control}
              name="serviceIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Services</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <Select
                        value=""
                        onValueChange={(v) => {
                          const arr = field.value ?? [];
                          if (v && !arr.includes(v)) {
                            field.onChange([...arr, v]);
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Add service" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviceOptions
                            .filter((s) => s.status === "active" || (field.value ?? []).includes(s.id))
                            .filter((s) => !(field.value ?? []).includes(s.id))
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {(field.value ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(field.value ?? []).map((id) => {
                            const s = serviceOptions.find((x) => x.id === id);
                            return (
                              <Badge key={id} variant="secondary" className="gap-1 pr-1.5 pl-1.5">
                                {s?.name ?? id}
                                <button
                                  type="button"
                                  className="rounded-full hover:bg-muted p-0.5"
                                  onClick={() =>
                                    field.onChange((field.value ?? []).filter((x) => x !== id))
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEffectiveOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit">{isEdit ? t("saveChanges") : t("createClientSubmit")}</Button>
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
