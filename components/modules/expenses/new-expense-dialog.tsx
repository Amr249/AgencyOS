"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { createExpense, updateExpense, type ExpenseRow } from "@/actions/expenses";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import {
  ClientSelectOptionRow,
  ProjectSelectOptionRow,
  TeamMemberSelectOptionRow,
} from "@/components/entity-select-option";

const categoryValues = [
  "software",
  "hosting",
  "marketing",
  "salaries",
  "equipment",
  "office",
  "other",
] as const;

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  category: z.enum(categoryValues),
  date: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
  receiptUrl: z.string().url().optional().nullable(),
  teamMemberId: z.string().uuid().optional().nullable(),
  projectId: z.union([z.string().uuid(), z.null()]),
  clientId: z.union([z.string().uuid(), z.null()]),
  serviceIds: z.array(z.string().uuid()).default([]),
  isBillable: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

type TeamMemberOption = { id: string; name: string; role: string | null; avatarUrl?: string | null };

export type ExpenseDialogProject = {
  id: string;
  name: string;
  clientId: string;
  coverImageUrl?: string | null;
  clientLogoUrl?: string | null;
};
export type ExpenseDialogClient = { id: string; companyName: string; logoUrl?: string | null };
export type ExpenseDialogService = { id: string; name: string };

type NewExpenseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Row being edited; omit for new expense */
  expense?: ExpenseRow | null;
  teamMembers?: TeamMemberOption[];
  projects?: ExpenseDialogProject[];
  clients?: ExpenseDialogClient[];
  services?: ExpenseDialogService[];
  /** Pre-fill when adding an expense from a project (or other) context */
  defaultProjectId?: string;
  defaultClientId?: string;
};

function getTodayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function NewExpenseDialog({
  open,
  onOpenChange,
  onSuccess,
  expense,
  teamMembers = [],
  projects = [],
  clients = [],
  services: serviceOptions = [],
  defaultProjectId,
  defaultClientId,
}: NewExpenseDialogProps) {
  const tv = useTranslations("expenses.validation");
  const td = useTranslations("expenses.dialog");
  const tc = useTranslations("expenses.categories");
  const locale = useLocale();
  const isRtl = locale === "ar";

  const formSchema = React.useMemo(
    () =>
      z.object({
        title: z.string().min(1, tv("titleRequired")),
        amount: z.coerce.number().positive(tv("amountPositive")),
        category: z.enum(categoryValues),
        date: z.string().min(1, tv("dateRequired")),
        notes: z.string().optional(),
        receiptUrl: z.string().url().optional().nullable(),
        teamMemberId: z.string().uuid().optional().nullable(),
        projectId: z.union([z.string().uuid(), z.null()]),
        clientId: z.union([z.string().uuid(), z.null()]),
        serviceIds: z.array(z.string().uuid()).default([]),
        isBillable: z.boolean(),
      }),
    [tv]
  );

  const [receiptUploading, setReceiptUploading] = React.useState(false);
  const receiptFileInputRef = React.useRef<HTMLInputElement>(null);
  const isEdit = !!expense;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      amount: 0,
      category: "other",
      date: getTodayISO(),
      notes: "",
      receiptUrl: null,
      teamMemberId: null,
      projectId: null,
      clientId: null,
      serviceIds: [],
      isBillable: false,
    },
  });

  const projectIdWatch = form.watch("projectId");

  React.useEffect(() => {
    if (projectIdWatch && projects.length > 0) {
      const project = projects.find((p) => p.id === projectIdWatch);
      if (project?.clientId) {
        form.setValue("clientId", project.clientId);
      }
    }
  }, [projectIdWatch, projects, form]);

  React.useEffect(() => {
    if (open && expense) {
      form.reset({
        title: expense.title,
        amount: Number(expense.amount),
        category: expense.category,
        date: expense.date,
        notes: expense.notes ?? "",
        receiptUrl: expense.receiptUrl,
        teamMemberId: expense.teamMemberId ?? null,
        projectId: expense.projectId ?? null,
        clientId: expense.clientId ?? null,
        serviceIds: expense.serviceIds ?? [],
        isBillable: expense.isBillable ?? false,
      });
    } else if (open && !expense) {
      form.reset({
        title: "",
        amount: 0,
        category: "other",
        date: getTodayISO(),
        notes: "",
        receiptUrl: null,
        teamMemberId: null,
        projectId: defaultProjectId ?? null,
        clientId: defaultClientId ?? null,
        serviceIds: [],
        isBillable: false,
      });
    }
  }, [open, expense, form, defaultProjectId, defaultClientId]);

  async function handleReceiptUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setReceiptUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("scope", "expense-receipt");
      if (expense?.id) formData.set("entityId", expense.id);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? td("toastUploadFail"));
      form.setValue("receiptUrl", data.url);
      toast.success(td("toastReceiptUploaded"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : td("toastUploadFail"));
    } finally {
      setReceiptUploading(false);
      e.target.value = "";
    }
  }

  async function onSubmit(values: FormValues) {
    const shared = {
      title: values.title,
      amount: values.amount,
      category: values.category,
      date: values.date,
      notes: values.notes || undefined,
      receiptUrl: values.receiptUrl ?? null,
      teamMemberId: values.teamMemberId ?? null,
      projectId: values.projectId ?? null,
      clientId: values.clientId ?? null,
      serviceIds: values.serviceIds ?? [],
      isBillable: values.isBillable,
    };
    if (isEdit && expense) {
      const res = await updateExpense({
        id: expense.id,
        ...shared,
      });
      if (res.ok) {
        toast.success(td("toastUpdated"));
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(typeof res.error === "string" ? res.error : td("toastFailedUpdate"));
      }
    } else {
      const res = await createExpense(shared);
      if (res.ok) {
        toast.success(td("toastAdded"));
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(typeof res.error === "string" ? res.error : td("toastFailedSave"));
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir={isRtl ? "rtl" : "ltr"}>
        <DialogHeader>
          <DialogTitle>{isEdit ? td("editTitle") : td("addTitle")}</DialogTitle>
          <DialogDescription>{isEdit ? td("editDescription") : td("addDescription")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{td("title")}</FormLabel>
                  <FormControl>
                    <Input placeholder={td("titlePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="inline-flex items-center gap-1">
                    {td("amount")}
                    <SarCurrencyIcon className="h-3.5 w-3.5 shrink-0" />
                  </FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" min="0" placeholder="0" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{td("category")}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={td("categoryPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categoryValues.map((c) => (
                        <SelectItem key={c} value={c}>
                          {tc(c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {projects.length > 0 && (
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-start">{td("project")}</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger id="project">
                          <SelectValue placeholder={td("projectPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{td("noProject")}</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id} textValue={project.name}>
                            <ProjectSelectOptionRow
                              coverImageUrl={project.coverImageUrl}
                              clientLogoUrl={project.clientLogoUrl}
                              name={project.name}
                            />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {clients.length > 0 && (
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-start">{td("client")}</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger id="client">
                          <SelectValue placeholder={td("clientPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">{td("noClient")}</SelectItem>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id} textValue={client.companyName}>
                            <ClientSelectOptionRow logoUrl={client.logoUrl} label={client.companyName} />
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              control={form.control}
              name="isBillable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      id="billable"
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked === true)}
                    />
                  </FormControl>
                  <FormLabel htmlFor="billable" className="cursor-pointer text-sm font-normal leading-none">
                    {td("billableLabel")}
                  </FormLabel>
                </FormItem>
              )}
            />
            {form.watch("category") === "salaries" && teamMembers.length > 0 && (
              <FormField
                control={form.control}
                name="teamMemberId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="block text-start">{td("teamMember")}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={td("teamMemberPlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {teamMembers.map((m) => (
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            {form.watch("category") === "salaries" && serviceOptions.length > 0 && (
              <FormField
                control={form.control}
                name="serviceIds"
                render={({ field }) => {
                  const selected = field.value ?? [];
                  const toggle = (id: string) => {
                    const next = selected.includes(id)
                      ? selected.filter((s: string) => s !== id)
                      : [...selected, id];
                    field.onChange(next);
                  };
                  return (
                    <FormItem>
                      <FormLabel className="block text-start">{td("servicesProvided")}</FormLabel>
                      <div className="rounded-md border p-3 space-y-2 max-h-40 overflow-y-auto">
                        {serviceOptions.map((s) => (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={selected.includes(s.id)}
                              onCheckedChange={() => toggle(s.id)}
                            />
                            <span className="text-sm">{s.name}</span>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            )}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{td("date")}</FormLabel>
                  <FormControl>
                    <DatePickerAr
                      value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                      onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                      placeholder={td("datePlaceholder")}
                      popoverAlign="start"
                    />
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
                  <FormLabel>{td("notes")}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={td("notesPlaceholder")} className="min-h-[80px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="receiptUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{td("receipt")}</FormLabel>
                  <FormControl>
                    <div className="flex flex-col gap-2">
                      <input
                        ref={receiptFileInputRef}
                        type="file"
                        accept="image/*,.pdf"
                        disabled={receiptUploading}
                        onChange={handleReceiptUpload}
                        className="sr-only"
                        aria-label={td("chooseFile")}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={receiptUploading}
                          onClick={() => receiptFileInputRef.current?.click()}
                        >
                          {td("chooseFile")}
                        </Button>
                        {(receiptUploading || !field.value) && (
                          <span className="text-sm text-muted-foreground truncate max-w-[min(100%,14rem)]">
                            {receiptUploading ? td("uploadingReceipt") : td("noFileChosen")}
                          </span>
                        )}
                      </div>
                      {field.value && (
                        <a
                          href={field.value}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary underline"
                        >
                          {td("viewReceipt")}
                        </a>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className={`gap-2 sm:gap-0 ${isRtl ? "flex-row-reverse sm:flex-row-reverse" : ""}`}>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {td("cancel")}
              </Button>
              <Button type="submit">{isEdit ? td("saveChanges") : td("addExpense")}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
