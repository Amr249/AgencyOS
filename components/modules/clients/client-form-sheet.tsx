"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { createClient, updateClient, type CreateClientInput } from "@/actions/clients";
import { clientTagBadgeClass } from "@/lib/client-metadata";
import { CLIENT_LOSS_CATEGORIES } from "@/lib/client-loss";
import { CLIENT_SOURCE_VALUES, type ClientSourceValue } from "@/lib/client-constants";
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
import { useTrialStatus, useUpgradeToContinueTitle } from "@/hooks/use-trial-status";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { X } from "lucide-react";

function createClientFormSchema(
  t: (key: string) => string,
  opts: { isEdit: boolean; prevClientStatus?: string | null }
) {
  return z
    .object({
      companyName: z.string().min(1, t("validation.companyRequired")),
      status: z.enum(["lead", "active", "on_hold", "completed", "closed"]),
      contactName: z.string().optional(),
      contactEmail: z.string().email(t("validation.invalidEmail")).optional().or(z.literal("")),
      contactPhone: z.string().min(1, t("validation.phoneRequired")),
      website: z.string().url(t("validation.invalidUrl")).optional().or(z.literal("")),
      logoUrl: z.string().url(t("validation.invalidUrl")).optional().or(z.literal("")),
      notes: z.string().optional(),
      source: z.string().optional(),
      sourceDetails: z.string().optional(),
      tagIds: z.array(z.string().uuid()).optional(),
      serviceIds: z.array(z.string()).optional(),
      lossCategory: z.enum(CLIENT_LOSS_CATEGORIES).optional(),
      lossNotes: z.string().max(5000).optional(),
    })
    .superRefine((data, ctx) => {
      const needsLoss =
        data.status === "closed" &&
        (!opts.isEdit || (opts.prevClientStatus ?? "lead") !== "closed");
      if (needsLoss) {
        if (!data.lossCategory) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.required"),
            path: ["lossCategory"],
          });
        }
        if (!data.lossNotes?.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.required"),
            path: ["lossNotes"],
          });
        }
      }
    });
}

type FormValues = z.infer<ReturnType<typeof createClientFormSchema>>;

type ClientRow = typeof clients.$inferSelect;

/** Stable defaults — `param = []` creates a new array every render and retriggers effects. */
const EMPTY_SERVICE_OPTIONS: { id: string; name: string; status: string }[] = [];
const EMPTY_TAG_OPTIONS: { id: string; name: string; color: string }[] = [];
const EMPTY_ID_LIST: string[] = [];

type ClientFormSheetProps = {
  trigger?: React.ReactNode;
  client?: ClientRow;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  asChild?: boolean;
  serviceOptions?: { id: string; name: string; status: string }[];
  initialServiceIds?: string[];
  tagOptions?: { id: string; name: string; color: string }[];
  initialTagIds?: string[];
};

export function ClientFormSheet({
  trigger,
  client,
  open,
  onOpenChange,
  asChild,
  serviceOptions = EMPTY_SERVICE_OPTIONS,
  initialServiceIds = EMPTY_ID_LIST,
  tagOptions = EMPTY_TAG_OPTIONS,
  initialTagIds = EMPTY_ID_LIST,
}: ClientFormSheetProps) {
  const t = useTranslations("clients");
  const tc = useTranslations("common");
  const translateErr = useTranslateActionError();
  /** Maps server English `_form` / upload messages so Arabic UI shows Arabic toasts. */
  const translateClientMsg = React.useCallback(
    (msg: string) => {
      if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(msg)) {
        return msg;
      }
      switch (msg) {
        case "Failed to create client":
        case "Failed to create":
          return t("actionErrors.failedCreate");
        case "Failed to update client":
        case "Failed to update":
          return t("actionErrors.failedUpdate");
        case "Invalid service selection":
          return t("actionErrors.invalidService");
        case "Client not found":
          return t("actionErrors.clientNotFound");
        case "Invalid tag id":
          return t("actionErrors.invalidTag");
        case "Upload failed":
          return t("actionErrors.uploadFailed");
        case "Logo upload failed":
          return t("actionErrors.logoUploadFailed");
        default:
          return translateErr(msg);
      }
    },
    [t, translateErr]
  );
  const trial = useTrialStatus();
  const upgradeTip = useUpgradeToContinueTitle();
  const writeBlocked = trial?.writeBlocked ?? false;
  const isEdit = !!client;
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const effectiveOpen = isControlled ? open : dialogOpen;
  const setEffectiveOpen = isControlled ? onOpenChange : setDialogOpen;

  const [logoUploading, setLogoUploading] = React.useState(false);
  const logoFileInputRef = React.useRef<HTMLInputElement>(null);

  const formSchema = React.useMemo(
    () => createClientFormSchema(t, { isEdit, prevClientStatus: client?.status }),
    [t, isEdit, client?.status]
  );

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

  function toSourcePayload(src: string | undefined): CreateClientInput["source"] {
    const s = src?.trim();
    if (!s) return null;
    return (CLIENT_SOURCE_VALUES as readonly string[]).includes(s)
      ? (s as ClientSourceValue)
      : null;
  }

  const formResolver = React.useMemo(() => zodResolver(formSchema), [formSchema]);

  const form = useForm<FormValues>({
    resolver: formResolver,
    defaultValues: {
      companyName: client?.companyName ?? "",
      status: client?.status ?? "lead",
      contactName: client?.contactName ?? "",
      contactEmail: client?.contactEmail ?? "",
      contactPhone: client?.contactPhone ?? "",
      website: client?.website ?? "",
      logoUrl: client?.logoUrl ?? "",
      notes: client?.notes ?? "",
      source: client?.source ?? "",
      sourceDetails: client?.sourceDetails ?? "",
      tagIds: initialTagIds,
      serviceIds: initialServiceIds,
      lossCategory: "not_serious",
      lossNotes: "",
    },
  });

  const initialTagIdsKey = initialTagIds.join("|");
  const initialServiceIdsKey = initialServiceIds.join("|");
  const clientKey = client?.id ?? "";

  React.useEffect(() => {
    if (!effectiveOpen) return;
    if (client) {
      form.reset({
        companyName: client.companyName,
        status: client.status,
        contactName: client.contactName ?? "",
        contactEmail: client.contactEmail ?? "",
        contactPhone: client.contactPhone ?? "",
        website: client.website ?? "",
        logoUrl: client.logoUrl ?? "",
        notes: client.notes ?? "",
        source: client.source ?? "",
        sourceDetails: client.sourceDetails ?? "",
        tagIds: [...initialTagIds],
        serviceIds: [...initialServiceIds],
        lossCategory: "not_serious",
        lossNotes: "",
      });
    } else {
      form.reset({
        companyName: "",
        status: "lead",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
        website: "",
        logoUrl: "",
        notes: "",
        source: "",
        sourceDetails: "",
        tagIds: [],
        serviceIds: [],
        lossCategory: "not_serious",
        lossNotes: "",
      });
    }
    // Stable deps: avoid `form` (identity churn) and raw array refs (new [] each render).
  }, [effectiveOpen, clientKey, initialTagIdsKey, initialServiceIdsKey]);

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (writeBlocked) {
      toast.error(translateErr("trial_expired"));
      e.target.value = "";
      return;
    }
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("scope", "client-logo");
      formData.set("entityId", client?.id ?? crypto.randomUUID());
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        const errKey = typeof data.error === "string" ? data.error : "Upload failed";
        throw new Error(errKey);
      }
      if (data.url) form.setValue("logoUrl", data.url);
    } catch (err) {
      const m = err instanceof Error ? err.message : "Logo upload failed";
      toast.error(m === "trial_expired" ? translateErr(m) : translateClientMsg(m));
    } finally {
      setLogoUploading(false);
      e.target.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    if (writeBlocked) {
      toast.error(translateErr("trial_expired"));
      return;
    }
    const mustSendLoss =
      values.status === "closed" && (!isEdit || client?.status !== "closed");

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
        source: toSourcePayload(values.source),
        sourceDetails: values.sourceDetails?.trim()
          ? values.sourceDetails.trim()
          : null,
        tagIds: values.tagIds ?? [],
        serviceIds: values.serviceIds ?? [],
        ...(mustSendLoss && values.lossCategory && values.lossNotes?.trim()
          ? {
              lossCategory: values.lossCategory,
              lossNotes: values.lossNotes.trim(),
            }
          : {}),
      });
      if (result.ok) {
        toast.success(t("toastUpdated"));
        setEffectiveOpen(false);
      } else {
        const err = result.error as { _form?: string[] };
        const msg = err._form?.[0] ?? "Failed to update";
        toast.error(translateClientMsg(msg));
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
        source: toSourcePayload(values.source) ?? undefined,
        sourceDetails: values.sourceDetails?.trim()
          ? values.sourceDetails.trim()
          : undefined,
        tagIds: values.tagIds ?? [],
        serviceIds: values.serviceIds ?? [],
        ...(mustSendLoss && values.lossCategory && values.lossNotes?.trim()
          ? {
              lossCategory: values.lossCategory,
              lossNotes: values.lossNotes.trim(),
            }
          : {}),
      } as CreateClientInput);
      if (result.ok) {
        toast.success(t("toastCreated"));
        setEffectiveOpen(false);
      } else {
        const err = result.error as { _form?: string[] };
        const msg = err._form?.[0] ?? "Failed to create";
        toast.error(translateClientMsg(msg));
      }
    }
  }

   const watchedStatus = form.watch("status");
  const showLossFields =
    watchedStatus === "closed" && (!isEdit || (client?.status ?? "lead") !== "closed");

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
                  <SelectContent position="popper" sideOffset={4}>
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
          {showLossFields ? (
            <>
              <FormField
                control={form.control}
                name="lossCategory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lossCategoryLabel")}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value ?? "not_serious"}
                        className="gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="not_serious" id="form-lost-ns" />
                          <FormLabel htmlFor="form-lost-ns" className="font-normal">
                            {t("lossCategoryNotSerious")}
                          </FormLabel>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="rejected_work" id="form-lost-rw" />
                          <FormLabel htmlFor="form-lost-rw" className="font-normal">
                            {t("lossCategoryRejectedWork")}
                          </FormLabel>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lossNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("lossWhyLabel")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("lossWhyPlaceholder")}
                        className="resize-none"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-muted-foreground text-xs">{t("lossWhyHint")}</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          ) : null}
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
                  <Input type="email" placeholder={t("emailPlaceholder")} {...field} />
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
                  <Input placeholder={t("websitePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("pipelineSource")}</FormLabel>
                <Select
                  onValueChange={(v) => field.onChange(v === "__none" ? "" : v)}
                  value={field.value ? field.value : "__none"}
                >
                  <FormControl>
                    <SelectTrigger className="justify-start">
                      <SelectValue placeholder={t("sourcePlaceholder")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="__none">{t("sourceNone")}</SelectItem>
                    {CLIENT_SOURCE_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`sourceOptions.${value}`)}
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
            name="sourceDetails"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("sourceDetailsLabel")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("sourceDetailsPlaceholder")} {...field} />
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
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      ref={logoFileInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      disabled={logoUploading || writeBlocked}
                      title={writeBlocked ? upgradeTip : undefined}
                      onChange={onLogoChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={logoUploading || writeBlocked}
                      title={writeBlocked ? upgradeTip : undefined}
                      className="shrink-0"
                      onClick={() => logoFileInputRef.current?.click()}
                    >
                      {t("logoChooseFile")}
                    </Button>
                    <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                      {form.watch("logoUrl") ? t("logoUploadedBadge") : t("logoNoFileChosen")}
                    </span>
                    {form.watch("logoUrl") && (
                      <img
                        src={form.watch("logoUrl")}
                        alt={t("logoPreviewAlt")}
                        className="h-10 w-10 shrink-0 rounded object-cover"
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
          <FormField
            control={form.control}
            name="tagIds"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tagsLabel")}</FormLabel>
                <FormControl>
                  {tagOptions.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("tagsEmptyHint")}</p>
                  ) : (
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
                          <SelectValue placeholder={t("addTagPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
                          {tagOptions
                            .filter((s) => !(field.value ?? []).includes(s.id))
                            .map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                <span className="inline-flex items-center gap-2">
                                  <span
                                    className={`h-2 w-2 shrink-0 rounded-full ${
                                      s.color === "blue"
                                        ? "bg-blue-500"
                                        : s.color === "green"
                                          ? "bg-emerald-500"
                                          : s.color === "red"
                                            ? "bg-red-500"
                                            : s.color === "purple"
                                              ? "bg-purple-500"
                                              : s.color === "orange"
                                                ? "bg-orange-500"
                                                : "bg-neutral-400"
                                    }`}
                                    aria-hidden
                                  />
                                  {s.name}
                                </span>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {(field.value ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(field.value ?? []).map((id) => {
                            const s = tagOptions.find((x) => x.id === id);
                            return (
                              <Badge
                                key={id}
                                variant="secondary"
                                className={`gap-1 pr-1.5 pl-1.5 font-normal ${clientTagBadgeClass(s?.color)}`}
                              >
                                {s?.name ?? id}
                                <button
                                  type="button"
                                  className="rounded-full p-0.5 hover:bg-black/10"
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
                  )}
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
                  <FormLabel>{t("servicesLabel")}</FormLabel>
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
                          <SelectValue placeholder={t("addServicePlaceholder")} />
                        </SelectTrigger>
                        <SelectContent position="popper" sideOffset={4}>
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
            <Button type="submit" disabled={writeBlocked} title={writeBlocked ? upgradeTip : undefined}>
              {isEdit ? t("saveChanges") : t("createClientSubmit")}
            </Button>
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

  const resolvedOpen = writeBlocked ? false : effectiveOpen;
  const onDialogOpenChange = (v: boolean) => {
    if (writeBlocked && v) return;
    setEffectiveOpen(v);
  };

  const triggerNode =
    writeBlocked && trigger ? (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              {React.isValidElement(trigger)
                ? React.cloneElement(trigger as React.ReactElement<{ disabled?: boolean }>, {
                    disabled: true,
                  })
                : trigger}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {upgradeTip}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    ) : (
      trigger
    );

  if (isControlled) {
    return (
      <Dialog modal={false} open={resolvedOpen} onOpenChange={onDialogOpenChange}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog modal={false} open={resolvedOpen} onOpenChange={onDialogOpenChange}>
      {trigger && !writeBlocked ? (
        <DialogTrigger asChild={asChild}>{trigger}</DialogTrigger>
      ) : null}
      {writeBlocked ? triggerNode : null}
      {dialogContent}
    </Dialog>
  );
}
