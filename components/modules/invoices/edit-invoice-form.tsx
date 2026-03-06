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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatBudgetSAR } from "@/lib/utils";
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
  projectId: z.string().optional().nullable(),
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
  projectId: string | null;
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
      projectId: invoice.projectId ?? null,
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
    const projectId = values.projectId === "__none__" || !values.projectId ? undefined : values.projectId;
    const result = await updateInvoice({
      id: invoice.id,
      clientId: values.clientId,
      projectId: projectId ?? null,
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
            <div className="grid gap-4 sm:grid-cols-2">
              <FormItem>
                <FormLabel>Client</FormLabel>
                <FormControl>
                  <Input readOnly value={invoice.clientName ?? invoice.clientId} className="bg-muted" />
                </FormControl>
              </FormItem>
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select
                      onValueChange={(v) => field.onChange(v === "__none__" ? null : v)}
                      value={field.value ?? "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">—</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        placeholder="اختر تاريخًا"
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
                  <div className="col-span-2">Unit Price (SAR)</div>
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
                      {formatBudgetSAR(
                        String(
                          (lineItems[i]?.quantity ?? 0) * (lineItems[i]?.unitPrice ?? 0) * (1 + (lineItems[i]?.taxRate ?? 0) / 100)
                        )
                      )}
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
                    <span>{formatBudgetSAR(String(subtotal.toFixed(2)))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatBudgetSAR(String(taxTotal.toFixed(2)))}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Grand Total</span>
                    <span>{formatBudgetSAR(String(grandTotal.toFixed(2)))}</span>
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
