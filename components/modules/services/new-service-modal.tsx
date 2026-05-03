"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createService, updateService, type ServiceRow } from "@/actions/services";
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLocale, useTranslations } from "next-intl";

type ServiceFormValues = {
  name: string;
  description?: string;
  status: "active" | "inactive";
};

export function NewServiceModal({
  trigger,
  service,
  open,
  onOpenChange,
  asChild,
  onSuccess,
}: {
  trigger: React.ReactNode;
  service?: ServiceRow;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
  asChild?: boolean;
  onSuccess?: () => void;
}) {
  const t = useTranslations("servicesPage");
  const locale = useLocale();
  const pageDir = locale === "ar" ? "rtl" : "ltr";
  const [localOpen, setLocalOpen] = React.useState(false);
  const controlled = open !== undefined && onOpenChange !== undefined;
  const isOpen = controlled ? open : localOpen;
  const setOpen = controlled ? onOpenChange! : setLocalOpen;

  const schema = React.useMemo(
    () =>
      z.object({
        name: z.string().min(1, t("validationNameRequired")),
        description: z.string().optional(),
        status: z.enum(["active", "inactive"]),
      }),
    [t]
  );

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: service?.name ?? "",
      description: service?.description ?? "",
      status: (service?.status as "active" | "inactive") ?? "active",
    },
  });

  React.useEffect(() => {
    if (!isOpen) return;
    form.reset({
      name: service?.name ?? "",
      description: service?.description ?? "",
      status: (service?.status as "active" | "inactive") ?? "active",
    });
  }, [isOpen, service, form]);

  const fieldAlign = pageDir === "rtl" ? "text-end" : "text-start";

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild={asChild}>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg" dir={pageDir}>
        <DialogHeader className={fieldAlign}>
          <DialogTitle>{service ? t("modalEditTitle") : t("modalNewTitle")}</DialogTitle>
          <DialogDescription>{service ? t("modalEditDescription") : t("modalNewDescription")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              const result = service ? await updateService({ id: service.id, ...values }) : await createService(values);
              if (result.ok) {
                toast.success(service ? t("toastServiceUpdated") : t("toastServiceCreated"));
                setOpen(false);
                onSuccess?.();
              } else {
                const err = result.error as { _form?: string[] } | Record<string, string[]>;
                toast.error(err?._form?.[0] ?? t("toastOperationFailed"));
              }
            })}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={fieldAlign}>
                  <FormLabel>{t("nameRequiredLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("placeholderServiceName")} className={fieldAlign} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem className={fieldAlign}>
                  <FormLabel>{t("description")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t("placeholderDescription")} className={`resize-none ${fieldAlign}`} {...field} />
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
                  <Select value={field.value} onValueChange={field.onChange}>
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
            <DialogFooter className={pageDir === "rtl" ? "sm:flex-row-reverse sm:justify-start" : undefined}>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("cancel")}
              </Button>
              <Button type="submit">{service ? t("saveChanges") : t("createService")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
