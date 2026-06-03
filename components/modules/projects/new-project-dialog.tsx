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
import { useTrialStatus, useUpgradeToContinueTitle } from "@/hooks/use-trial-status";
import { useTranslateActionError } from "@/hooks/use-translate-action-error";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ClientSelectOptionRow,
  TeamMemberSelectOptionRow,
  entityInitials,
} from "@/components/entity-select-option";
import { useLocale, useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";

const PROJECT_STATUS_VALUES = [
  "lead",
  "active",
  "on_hold",
  "review",
  "completed",
  "cancelled",
] as const;

function buildProjectFormSchema(messages: { nameRequired: string; clientRequired: string }) {
  return z
    .object({
      name: z.string().min(1, messages.nameRequired),
      isInternal: z.boolean().default(false),
      clientId: z.string().uuid().optional().or(z.literal("")),
      status: z.enum(["lead", "active", "on_hold", "review", "completed", "cancelled"]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      budget: z.coerce.number().min(0).optional(),
      description: z.string().optional(),
      teamMemberIds: z.array(z.string()).optional(),
      serviceIds: z.array(z.string()).optional(),
    })
    .superRefine((data, ctx) => {
      if (!data.isInternal && !data.clientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: messages.clientRequired,
          path: ["clientId"],
        });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildProjectFormSchema>>;

type ClientOption = { id: string; companyName: string | null; logoUrl?: string | null };
type TeamMemberOption = { id: string; name: string; role: string | null; avatarUrl?: string | null };
type ServiceOption = { id: string; name: string; status: string };

type NewProjectDialogProps = {
  trigger?: React.ReactNode;
  clients: ClientOption[];
  teamMembers?: TeamMemberOption[];
  services?: ServiceOption[];
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
  teamMembers = [],
  services = [],
  defaultCurrency: _defaultCurrency = "USD",
  defaultClientId,
  open,
  onOpenChange,
  asChild,
  onSuccess,
}: NewProjectDialogProps) {
  const appLocale = useLocale();
  const isAr = appLocale === "ar";
  const selectDir = isAr ? "rtl" : "ltr";
  const td = useTranslations("projects.newProjectDialog");
  const ts = useTranslations("projects.status");

  const formSchema = React.useMemo(
    () =>
      buildProjectFormSchema({
        nameRequired: td("validation.nameRequired"),
        clientRequired: td("validation.clientRequired"),
      }),
    [td]
  );

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [coverImageUrl, setCoverImageUrl] = React.useState<string | null>(null);
  const [coverUploading, setCoverUploading] = React.useState(false);
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const isControlled = open !== undefined && onOpenChange !== undefined;
  const effectiveOpen = isControlled ? open : dialogOpen;
  const setEffectiveOpen = isControlled ? onOpenChange : setDialogOpen;
  const trial = useTrialStatus();
  const writeBlocked = trial?.writeBlocked ?? false;
  const upgradeTip = useUpgradeToContinueTitle();
  const translateErr = useTranslateActionError();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      isInternal: false,
      clientId: "",
      status: "lead",
      startDate: "",
      endDate: "",
      budget: undefined,
      description: "",
      teamMemberIds: [],
      serviceIds: [],
    },
  });

  const lockedClient = !!defaultClientId;
  const isInternal = form.watch("isInternal");
  React.useEffect(() => {
    if (effectiveOpen && !form.formState.isDirty) {
      setCoverImageUrl(null);
      form.reset({
        name: "",
        isInternal: false,
        clientId: defaultClientId ?? "",
        status: "lead",
        startDate: "",
        endDate: "",
        budget: undefined,
        description: "",
        teamMemberIds: [],
        serviceIds: [],
      });
    }
  }, [effectiveOpen, form, defaultClientId]);

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (writeBlocked) {
      toast.error(translateErr("trial_expired"));
      e.target.value = "";
      return;
    }
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("scope", "project-cover");
      fd.set("entityId", crypto.randomUUID());
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) {
        setCoverImageUrl(data.url);
      } else {
        const key = typeof data.error === "string" ? data.error : "Upload failed";
        toast.error(key === "trial_expired" ? translateErr(key) : (data.error ?? td("uploadFailed")));
      }
    } catch {
      toast.error(td("uploadFailed"));
    } finally {
      setCoverUploading(false);
      e.target.value = "";
    }
  };

  async function onSubmit(values: FormValues) {
    if (writeBlocked) {
      toast.error(translateErr("trial_expired"));
      return;
    }
    const payload: CreateProjectInput = {
      name: values.name,
      isInternal: values.isInternal,
      clientId: values.isInternal ? undefined : values.clientId || undefined,
      status: values.status,
      coverImageUrl: coverImageUrl ?? undefined,
      startDate: values.startDate || undefined,
      endDate: values.endDate || undefined,
      budget: values.budget,
      description: values.description || undefined,
      teamMemberIds: values.teamMemberIds?.length ? values.teamMemberIds : undefined,
      serviceIds: values.serviceIds?.length ? values.serviceIds : undefined,
    };

    const result = await createProject(payload);

    if (result.ok) {
      toast.success(td("toastCreated"));
      setEffectiveOpen(false);
      onSuccess?.();
    } else {
      const err = result.error as { _form?: string[] } | Record<string, string[]>;
      const msg =
        err._form?.[0] ?? Object.values(err ?? {}).flat().find(Boolean) ?? td("toastCreateFailed");
      toast.error(translateErr(String(msg)));
    }
  }

  const content = (
    <>
      <DialogHeader>
        <DialogTitle>{td("title")}</DialogTitle>
        <DialogDescription>{td("description")}</DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{td("coverLabel")}</label>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
              disabled={coverUploading || writeBlocked}
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading || writeBlocked}
                title={writeBlocked ? upgradeTip : undefined}
              >
                {coverUploading
                  ? td("uploading")
                  : coverImageUrl
                    ? td("replaceImage")
                    : td("uploadCover")}
              </Button>
              {coverImageUrl && (
                <>
                  <img
                    src={coverImageUrl}
                    alt={td("coverPreviewAlt")}
                    className="h-14 w-14 rounded border object-cover"
                  />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setCoverImageUrl(null)}>
                    {td("removeCover")}
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
                <FormLabel>{td("projectNameLabel")}</FormLabel>
                <FormControl>
                  <Input placeholder={td("projectNamePlaceholder")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {!lockedClient && (
            <FormField
              control={form.control}
              name="isInternal"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel>{td("isInternalLabel")}</FormLabel>
                    <p className="text-muted-foreground text-sm">{td("isInternalHint")}</p>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={(v) => {
                        field.onChange(v);
                        if (v) form.setValue("clientId", "");
                      }}
                      disabled={writeBlocked}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem className={isInternal && !lockedClient ? "hidden" : undefined}>
                <FormLabel>{td("clientLabel")}</FormLabel>
                {lockedClient ? (
                  <div className="border-input bg-muted text-muted-foreground flex h-9 items-center gap-2 rounded-md border px-3 py-1 text-sm">
                    {(() => {
                      const c = clients.find((x) => x.id === field.value);
                      const label = c?.companyName ?? field.value;
                      return (
                        <>
                          <Avatar className="h-5 w-5 shrink-0">
                            <AvatarImage src={c?.logoUrl?.trim() || undefined} alt="" />
                            <AvatarFallback className="text-[10px]">{entityInitials(label, 1)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{label}</span>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={td("selectClient")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent dir={selectDir}>
                      {clients.map((c) => {
                        const label = c.companyName || c.id;
                        return (
                          <SelectItem key={c.id} value={c.id} textValue={label}>
                            <ClientSelectOptionRow logoUrl={c.logoUrl} label={label} />
                          </SelectItem>
                        );
                      })}
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
                <FormLabel>{td("statusLabel")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent dir={selectDir}>
                    {PROJECT_STATUS_VALUES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {ts(value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          {teamMembers.length > 0 && (
            <FormField
              control={form.control}
              name="teamMemberIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{td("teamMembersLabel")}</FormLabel>
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
                          <SelectValue placeholder={td("addTeamMember")} />
                        </SelectTrigger>
                        <SelectContent dir={selectDir}>
                          {teamMembers
                            .filter((m) => !(field.value ?? []).includes(m.id))
                            .map((m) => (
                              <SelectItem
                                key={m.id}
                                value={m.id}
                                textValue={`${m.name} ${m.role ?? ""}`}
                              >
                                <TeamMemberSelectOptionRow
                                  avatarUrl={m.avatarUrl}
                                  name={m.name}
                                  secondary={m.role ?? "—"}
                                />
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      {(field.value ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(field.value ?? []).map((id) => {
                            const m = teamMembers.find((x) => x.id === id);
                            return (
                              <Badge
                                key={id}
                                variant="secondary"
                                className="gap-1 ps-1.5 pe-1.5"
                              >
                                <Avatar className="h-4 w-4 shrink-0">
                                  <AvatarImage src={m?.avatarUrl?.trim() || undefined} alt="" />
                                  <AvatarFallback className="text-[8px]">
                                    {entityInitials(m?.name ?? id, 1)}
                                  </AvatarFallback>
                                </Avatar>
                                {m?.name ?? id}
                                <button
                                  type="button"
                                  className="hover:bg-muted rounded-full p-0.5"
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
          {services.length > 0 && (
            <FormField
              control={form.control}
              name="serviceIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{td("servicesLabel")}</FormLabel>
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
                          <SelectValue placeholder={td("addService")} />
                        </SelectTrigger>
                        <SelectContent dir={selectDir}>
                          {services
                            .filter((s) => s.status === "active")
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
                            const s = services.find((x) => x.id === id);
                            return (
                              <Badge
                                key={id}
                                variant="secondary"
                                className="gap-1 ps-1.5 pe-1.5"
                              >
                                {s?.name ?? id}
                                <button
                                  type="button"
                                  className="hover:bg-muted rounded-full p-0.5"
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
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="startDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{td("startDate")}</FormLabel>
                  <FormControl>
                    <DatePickerAr
                      value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                      onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      placeholder={td("selectDate")}
                      popoverAlign={isAr ? "end" : "start"}
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
                  <FormLabel>{td("endDate")}</FormLabel>
                  <FormControl>
                    <DatePickerAr
                      value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                      onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      placeholder={td("selectDate")}
                      popoverAlign={isAr ? "end" : "start"}
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
                <FormLabel className="inline-flex items-center gap-1">
                  {td("budgetLabel")}
                  <SarCurrencyIcon className="h-3.5 w-3.5 shrink-0" />
                </FormLabel>
                <FormControl>
                  <Input type="number" min={0} step="0.01" placeholder={td("budgetPlaceholder")} {...field} />
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
                <FormLabel>{td("descriptionLabel")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={td("descriptionPlaceholder")}
                    className="resize-none"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter className={isAr ? "flex-row-reverse gap-2 sm:justify-start" : undefined}>
            <Button type="button" variant="outline" onClick={() => setEffectiveOpen(false)}>
              {td("cancel")}
            </Button>
            <Button type="submit" disabled={writeBlocked} title={writeBlocked ? upgradeTip : undefined}>
              {td("submit")}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );

  const dialogContent = (
    <DialogContent
      className="max-h-[90vh] max-w-xl overflow-y-auto text-start"
      dir={isAr ? "rtl" : "ltr"}
      lang={isAr ? "ar" : "en"}
    >
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
      <Dialog open={resolvedOpen} onOpenChange={onDialogOpenChange}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={resolvedOpen} onOpenChange={onDialogOpenChange}>
      {trigger && !writeBlocked ? (
        <DialogTrigger asChild={asChild}>
          {trigger}
        </DialogTrigger>
      ) : null}
      {writeBlocked ? triggerNode : null}
      {dialogContent}
    </Dialog>
  );
}
