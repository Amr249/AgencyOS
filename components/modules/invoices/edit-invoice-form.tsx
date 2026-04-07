"use client";

import * as React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateInvoice } from "@/actions/invoices";
import { getProjects } from "@/actions/projects";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { SarMoney } from "@/components/ui/sar-money";
import { Cross2Icon } from "@radix-ui/react-icons";
import { DatePickerAr } from "@/components/ui/date-picker-ar";

const lineItemSchema = z.object({
  description: z.string().min(1, "Description required"),
  quantity: z.coerce.number().min(0.01),
  unitPrice: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100),
});

const formSchema = z.object({
  clientId: z.string().uuid(),
  projectIds: z.array(z.string().uuid()).optional(),
  invoiceNumber: z.string().min(1),
  issueDate: z.string().min(1),
  currency: z.string(),
  notes: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1),
});

type FormValues = z.infer<typeof formSchema>;

type InvoiceData = {
  id: string;
  clientId: string;
  clientName?: string | null;
  /** Linked projects (from invoice_projects or legacy project_id) */
  linkedProjectIds?: string[];
  invoiceNumber: string;
  issueDate: string;
  currency: string;
  notes: string | null;
  items: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    taxRate: string;
    amount: string;
    order: number;
  }>;
};

type ProjectOption = { id: string; name: string };
type SettingsRow = { id: number } | null;

export function EditInvoiceForm({
  invoice,
  settings,
}: {
  invoice: InvoiceData;
  settings: SettingsRow;
}) {
  const [projects, setProjects] = React.useState<ProjectOption[]>([]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientId: invoice.clientId,
      projectIds: invoice.linkedProjectIds ?? [],
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      currency: invoice.currency,
      notes: invoice.notes ?? "",
      lineItems: invoice.items
        .sort((a, b) => a.order - b.order)
        .map((i) => ({
          description: i.description,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          taxRate: Number(i.taxRate),
        })),
    },
  });

  React.useEffect(() => {
    getProjects({ clientId: invoice.clientId }).then((r) => {
      if (r.ok) setProjects(r.data.map((p) => ({ id: p.id, name: p.name })));
    });
  }, [invoice.clientId]);

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "lineItems" });
  const lineItems = form.watch("lineItems");
  const { subtotal, taxTotal, grandTotal } = React.useMemo(() => {
    let s = 0, t = 0;
    for (const row of lineItems) {
      const sub = row.quantity * row.unitPrice;
      t += (sub * (row.taxRate || 0)) / 100;
      s += sub;
    }
    return { subtotal: s, taxTotal: t, grandTotal: s + t };
  }, [lineItems]);

  async function onSubmit(values: FormValues) {
    const result = await updateInvoice({
      id: invoice.id,
      clientId: values.clientId,
      projectIds: values.projectIds ?? [],
      invoiceNumber: values.invoiceNumber,
      issueDate: values.issueDate,
      currency: values.currency,
      notes: values.notes ?? undefined,
      lineItems: values.lineItems,
    });
    if (result.ok) {
      toast.success("Invoice updated");
    } else {
      const err = result.error as { _form?: string[] };
      toast.error(err._form?.[0] ?? "Failed to update");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice details</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <FormItem>
                <FormLabel>Client</FormLabel>
                <FormControl>
                  <Input readOnly value={invoice.clientName ?? invoice.clientId} className="bg-muted" />
                </FormControl>
              </FormItem>
              <FormField
                control={form.control}
                name="projectIds"
                render={() => (
                  <FormItem>
                    <FormLabel>Projects (optional)</FormLabel>
                    <p className="text-muted-foreground mb-2 text-xs">
                      Select one or more projects, or leave empty.
                    </p>
                    {projects.length === 0 ? (
                      <p className="text-muted-foreground text-sm">No projects for this client.</p>
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
                                  <span>{p.name}</span>
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
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice number</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="issueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue date</FormLabel>
                    <FormControl>
                      <DatePickerAr
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
              <div className="mb-2 flex items-center justify-between">
                <FormLabel>Line items</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ description: "", quantity: 1, unitPrice: 0, taxRate: 0 })}
                >
                  + Add line item
                </Button>
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground">
                  <div className="col-span-4">Description</div>
                  <div className="col-span-2">Qty</div>
                  <div className="col-span-2">Unit Price</div>
                  <div className="col-span-2">Tax %</div>
                  <div className="col-span-1">Total</div>
                  <div className="col-span-1"></div>
                </div>
                {fields.map((field, i) => (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                    <FormField
                      control={form.control}
                      name={`lineItems.${i}.description`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-4">
                          <FormControl><Input placeholder="Description" {...f} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lineItems.${i}.quantity`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-2">
                          <FormControl><Input type="number" min={0.01} step={0.01} {...f} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lineItems.${i}.unitPrice`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-2">
                          <FormControl><Input type="number" min={0} step={0.01} {...f} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`lineItems.${i}.taxRate`}
                      render={({ field: f }) => (
                        <FormItem className="col-span-2">
                          <FormControl><Input type="number" min={0} max={100} step={0.01} {...f} /></FormControl>
                        </FormItem>
                      )}
                    />
                    <div className="col-span-1 text-sm">
                      <SarMoney
                        value={String(
                          (lineItems[i]?.quantity ?? 0) * (lineItems[i]?.unitPrice ?? 0) * (1 + (lineItems[i]?.taxRate ?? 0) / 100)
                        )}
                        iconClassName="h-3 w-3"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1 h-8 w-8 text-muted-foreground"
                      onClick={() => remove(i)}
                      disabled={fields.length === 1}
                    >
                      <Cross2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="mt-3 flex flex-col gap-1 border-t pt-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <SarMoney value={String(subtotal.toFixed(2))} iconClassName="h-3.5 w-3.5" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <SarMoney value={String(taxTotal.toFixed(2))} iconClassName="h-3.5 w-3.5" />
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Grand Total</span>
                    <SarMoney value={String(grandTotal.toFixed(2))} iconClassName="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea className="min-h-[80px] resize-y" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit">Save changes</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
