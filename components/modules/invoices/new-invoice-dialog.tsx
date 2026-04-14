"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createInvoice } from "@/actions/invoices";
import { getProjects } from "@/actions/projects";
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
import { formatAmount } from "@/lib/utils";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { Cross2Icon } from "@radix-ui/react-icons";
import { Lock } from "lucide-react";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { formatCalendarDate } from "@/lib/calendar-date";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ClientSelectOptionRow,
  ProjectSelectOptionRow,
  entityInitials,
} from "@/components/entity-select-option";

function SarAmount({ value }: { value: string }) {
  const f = formatAmount(value);
  if (f === "—") return <span>—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums" dir="ltr">
      {f}
      <SarCurrencyIcon className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
    </span>
  );
}

const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().min(0.01),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100),
});

const formSchema = z.object({
  clientId: z.string().uuid("Select a client"),
  projectIds: z.array(z.string().uuid()).optional(),
  invoiceNumber: z.string().min(1, "Invoice number required"),
  issueDate: z.string().min(1),
  notes: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1, "Add at least one line item"),
});

type FormValues = z.infer<typeof formSchema>;

type ClientOption = { id: string; companyName: string | null; logoUrl?: string | null };
type ProjectOption = {
  id: string;
  name: string;
  coverImageUrl?: string | null;
  clientLogoUrl?: string | null;
};
type SettingsData = {
  invoicePrefix: string | null;
  invoiceNextNumber: number | null;
  defaultCurrency: string | null;
  defaultPaymentTerms: number | null;
  invoiceFooter: string | null;
};

export type MilestoneInvoicePrefill = {
  milestoneName: string;
  /** Milestone billing amount (numeric string from DB or empty) */
  amount: string | null | undefined;
  projectId: string;
};

type NewInvoiceDialogProps = {
  /** Omit when dialog is only opened programmatically (`open` + `onOpenChange`). */
  trigger?: React.ReactNode;
  clients: ClientOption[];
  settings: SettingsData | null;
  nextInvoiceNumber: string;
  /** When set, client is pre-selected and locked (e.g. from client detail page). */
  defaultClientId?: string;
  /** When dialog opens, pre-fill line item and project checkboxes from a milestone. */
  milestonePrefill?: MilestoneInvoicePrefill | null;
  onSuccess?: (invoice: { id: string; invoiceNumber: string }) => void | Promise<void>;
  /** Controlled open state (e.g. for FAB on mobile). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function getDefaultDueDate(paymentTerms: number) {
  const d = new Date();
  d.setDate(d.getDate() + paymentTerms);
  return formatCalendarDate(d);
}

export function NewInvoiceDialog({
  trigger,
  clients,
  settings,
  nextInvoiceNumber,
  defaultClientId,
  milestonePrefill,
  onSuccess,
  open: openProp,
  onOpenChange: setOpenProp,
}: NewInvoiceDialogProps) {
  const [openLocal, setOpenLocal] = React.useState(false);
  const isControlled = openProp !== undefined && setOpenProp !== undefined;
  const open = isControlled ? openProp : openLocal;
  const setOpen = isControlled ? (setOpenProp!) : setOpenLocal;
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);
  const lockedClient = !!defaultClientId;
  const paymentTerms = settings?.defaultPaymentTerms ?? 30;
  const defaultNotes = settings?.invoiceFooter ?? "";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: defaultClientId ?? "",
      projectIds: [] as string[],
      invoiceNumber: nextInvoiceNumber,
      issueDate: formatCalendarDate(new Date()),
      notes: defaultNotes,
      lineItems: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 0 }],
    },
  });

  const clientId = form.watch("clientId");
  React.useEffect(() => {
    if (!clientId) {
      setProjects([]);
      form.setValue("projectIds", []);
      return;
    }
    getProjects({ clientId }).then((r) => {
      if (r.ok)
        setProjects(
          r.data.map((p) => ({
            id: p.id,
            name: p.name,
            coverImageUrl: p.coverImageUrl,
            clientLogoUrl: p.clientLogoUrl,
          }))
        );
      else setProjects([]);
    });
  }, [clientId, form]);

  const prefillKey = milestonePrefill
    ? `${milestonePrefill.projectId}:${milestonePrefill.milestoneName}:${milestonePrefill.amount ?? ""}`
    : "";

  React.useEffect(() => {
    if (!open) return;
    const unitPrice = milestonePrefill
      ? (() => {
          const raw = milestonePrefill.amount;
          if (raw == null || raw === "") return 0;
          const n = parseFloat(String(raw).replace(",", "."));
          return Number.isNaN(n) || n < 0 ? 0 : n;
        })()
      : 0;
    form.reset({
      clientId: defaultClientId ?? "",
      projectIds: milestonePrefill ? [milestonePrefill.projectId] : [],
      invoiceNumber: nextInvoiceNumber,
      issueDate: formatCalendarDate(new Date()),
      notes: defaultNotes,
      lineItems: milestonePrefill
        ? [
            {
              description: `Milestone: ${milestonePrefill.milestoneName}`,
              quantity: 1,
              unitPrice,
              taxRate: 0,
            },
          ]
        : [{ description: "", quantity: 1, unitPrice: 0, taxRate: 0 }],
    });
  }, [open, nextInvoiceNumber, defaultNotes, defaultClientId, form, milestonePrefill, prefillKey]);

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });

  const lineItems = form.watch("lineItems");
  const { subtotal, taxTotal, grandTotal } = React.useMemo(() => {
    let s = 0;
    let t = 0;
    for (const row of lineItems) {
      const sub = row.quantity * row.unitPrice;
      const tax = (sub * (row.taxRate || 0)) / 100;
      s += sub;
      t += tax;
    }
    return { subtotal: s, taxTotal: t, grandTotal: s + t };
  }, [lineItems]);

  async function onSubmit(values: FormValues) {
    const result = await createInvoice({
      ...values,
      status: "pending",
      projectIds: values.projectIds?.length ? values.projectIds : undefined,
      currency: "SAR",
      lineItems: values.lineItems,
    });
    if (!result.ok) {
      const err = result.error as { _form?: string[] };
      toast.error(err._form?.[0] ?? "Failed to create invoice");
      return;
    }
    try {
      const res = await fetch(`/api/invoices/${result.data.id}/pdf`);
      if (!res.ok) throw new Error("PDF failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${result.data.invoiceNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Invoice created but PDF download failed");
    }
    toast.success("Invoice created and PDF downloaded");
    const ret = onSuccess?.({ id: result.data.id, invoiceNumber: result.data.invoiceNumber });
    if (ret instanceof Promise) await ret;
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger != null ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-h-[90vh] w-[95vw] max-w-[95vw] overflow-y-auto sm:max-w-3xl" dir="ltr">
        <DialogHeader className="text-left">
          <DialogTitle>New invoice</DialogTitle>
          <DialogDescription>Create a new invoice. Client is required; add at least one line item.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="space-y-4 py-4">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem className="text-left">
                    <FormLabel>Client *</FormLabel>
                    {lockedClient ? (
                      <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground">
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
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger className="text-left">
                            <SelectValue placeholder="Select a client" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
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
                name="projectIds"
                render={() => (
                  <FormItem className="text-left">
                    <FormLabel>Projects (optional)</FormLabel>
                    <p className="text-muted-foreground mb-2 text-xs">
                      Select one or more projects for this client, or leave empty.
                    </p>
                    {projects.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No projects for this client yet.</p>
                    ) : (
                      <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
                        {projects.map((p) => (
                          <FormField
                            key={p.id}
                            control={form.control}
                            name="projectIds"
                            render={({ field }) => {
                              const checked = field.value?.includes(p.id) ?? false;
                              return (
                                <label className="flex cursor-pointer items-center gap-2 text-sm">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      const next = new Set(field.value ?? []);
                                      if (c === true) next.add(p.id);
                                      else next.delete(p.id);
                                      field.onChange([...next]);
                                    }}
                                  />
                                  <ProjectSelectOptionRow
                                    coverImageUrl={p.coverImageUrl}
                                    clientLogoUrl={p.clientLogoUrl}
                                    name={p.name}
                                  />
                                </label>
                              );
                            }}
                          />
                        ))}
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem className="text-left">
                    <FormLabel>Invoice number</FormLabel>
                    <FormControl>
                      <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-muted px-3 py-1 text-sm text-muted-foreground">
                        <Lock className="h-4 w-4 shrink-0" />
                        <span className="font-mono">{field.value}</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem className="text-left">
                    <FormLabel>Issue date</FormLabel>
                    <FormControl>
                      <DatePickerAr
                        popoverAlign="start"
                        value={field.value ? new Date(field.value + "T12:00:00") : undefined}
                        onChange={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                        placeholder="Pick a date"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <FormLabel className="mb-0">Line items</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ description: "", quantity: 1, unitPrice: 0, taxRate: 0 })}
                >
                  + Add line
                </Button>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <div className="grid grid-cols-1 gap-2 text-left text-xs font-medium text-muted-foreground sm:grid-cols-12">
                  <div className="hidden sm:block sm:col-span-4">Description</div>
                  <div className="hidden sm:block sm:col-span-2">Qty</div>
                  <div className="hidden items-center gap-1 sm:col-span-2 sm:flex">
                    <span>Unit price</span>
                    <SarCurrencyIcon className="h-3 w-3 text-neutral-500" aria-hidden />
                  </div>
                  <div className="hidden sm:block sm:col-span-2">Tax %</div>
                  <div className="hidden items-center gap-1 sm:col-span-1 sm:flex">
                    <span>Total</span>
                    <SarCurrencyIcon className="h-3 w-3 text-neutral-500" aria-hidden />
                  </div>
                  <div className="hidden sm:col-span-1 sm:block" />
                </div>
                {fields.map((field, i) => (
                  <div key={field.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-12 sm:gap-2">
                    <FormField
                      control={form.control}
                      name={`lineItems.${i}.description`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-1 sm:col-span-4">
                          <FormControl>
                            <Input placeholder="Description" className="text-left" {...f} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lineItems.${i}.quantity`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-1 sm:col-span-2">
                          <FormControl>
                            <Input type="number" min={0.01} step={0.01} className="text-left" {...f} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lineItems.${i}.unitPrice`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-1 sm:col-span-2">
                          <FormControl>
                            <Input type="number" min={0} step={0.01} className="text-left" {...f} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lineItems.${i}.taxRate`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-1 sm:col-span-2">
                          <FormControl>
                            <Input type="number" min={0} max={100} step={0.01} className="text-left" {...f} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="col-span-1 text-left text-sm sm:col-span-1">
                      <SarAmount
                        value={String(
                          (lineItems[i]?.quantity ?? 0) * (lineItems[i]?.unitPrice ?? 0) * (1 + (lineItems[i]?.taxRate ?? 0) / 100)
                        )}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1 h-8 w-8 min-h-[44px] min-w-[44px] text-muted-foreground md:min-h-8 md:min-w-8"
                      onClick={() => remove(i)}
                      disabled={fields.length === 1}
                    >
                      <Cross2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-left text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Subtotal</span>
                    <SarAmount value={String(subtotal.toFixed(2))} />
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Tax</span>
                    <SarAmount value={String(taxTotal.toFixed(2))} />
                  </div>
                  <div className="flex justify-between gap-4 font-semibold">
                    <span>Grand total</span>
                    <SarAmount value={String(grandTotal.toFixed(2))} />
                  </div>
                </div>
              </div>
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem className="text-left">
                  <FormLabel>Notes / payment instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      className="min-h-[80px] resize-y text-left"
                      placeholder="Payment terms, bank details…"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={form.handleSubmit(onSubmit)}>
                Create & download
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
