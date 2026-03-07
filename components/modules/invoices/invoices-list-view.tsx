"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteInvoice } from "@/actions/invoices";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { MarkAsPaidDialog } from "./mark-as-paid-dialog";
import { toast } from "sonner";
import { formatBudgetSAR, formatDate as formatDateDDMMYYYY } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { PlusCircledIcon, DotsHorizontalIcon } from "@radix-ui/react-icons";
import { NewInvoiceDialog } from "./new-invoice-dialog";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  clientId: string;
  projectId: string | null;
  status: string;
  issueDate: string;
  paidAt: Date | string | null;
  total: string;
  currency: string;
  clientName: string | null;
  clientLogoUrl: string | null;
  projectName: string | null;
};

type Stats = { totalInvoiced: number; collected: number; outstanding: number };

type ClientsOption = { id: string; companyName: string | null };
type SettingsData = {
  invoicePrefix: string | null;
  invoiceNextNumber: number | null;
  defaultCurrency: string | null;
  defaultPaymentTerms: number | null;
  invoiceFooter: string | null;
};

type InvoicesListViewProps = {
  invoices: InvoiceRow[];
  stats: Stats;
  clients: ClientsOption[];
  settings: SettingsData | null;
  nextInvoiceNumber: string;
};

const STATUS_OPTIONS = [
  { value: "all", label: "الكل" },
  { value: "pending", label: "بانتظار الدفع" },
  { value: "paid", label: "تم الدفع" },
];

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "كل الوقت" },
  { value: "this_month", label: "هذا الشهر" },
  { value: "last_month", label: "الشهر الماضي" },
  { value: "this_year", label: "هذه السنة" },
];



export function InvoicesListView({
  invoices,
  stats,
  clients,
  settings,
  nextInvoiceNumber,
}: InvoicesListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [invoiceToDelete, setInvoiceToDelete] = React.useState<{
    id: string;
    invoiceNumber: string;
    status: string;
  } | null>(null);
  const [payDialogInvoice, setPayDialogInvoice] = React.useState<{
    id: string;
    invoiceNumber: string;
  } | null>(null);
  const [newInvoiceOpen, setNewInvoiceOpen] = React.useState(false);
  const statusParam = searchParams.get("status") ?? "all";
  const dateRangeParam = searchParams.get("dateRange") ?? "all";
  const searchParam = searchParams.get("search") ?? "";

  const updateParams = React.useCallback(
    (updates: { status?: string; dateRange?: string; search?: string }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (updates.status !== undefined)
        updates.status && updates.status !== "all" ? next.set("status", updates.status) : next.delete("status");
      if (updates.dateRange !== undefined)
        updates.dateRange && updates.dateRange !== "all" ? next.set("dateRange", updates.dateRange) : next.delete("dateRange");
      if (updates.search !== undefined)
        updates.search ? next.set("search", updates.search) : next.delete("search");
      router.push(`/dashboard/invoices?${next.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const q = (form.elements.namedItem("search") as HTMLInputElement)?.value?.trim() ?? "";
    updateParams({ search: q || undefined });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row-reverse sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">الفواتير</h1>
        <NewInvoiceDialog
          clients={clients}
          settings={settings}
          nextInvoiceNumber={nextInvoiceNumber}
          open={newInvoiceOpen}
          onOpenChange={setNewInvoiceOpen}
          trigger={
            <Button variant="secondary" className="w-full sm:w-auto">
              <PlusCircledIcon className="me-2 h-4 w-4" />
              فاتورة جديدة
            </Button>
          }
          onSuccess={() => router.refresh()}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="pt-4 text-right">
            <p className="text-muted-foreground text-sm">إجمالي الفواتير</p>
            <p className="text-2xl font-semibold">{formatBudgetSAR(String(stats.totalInvoiced))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-right">
            <p className="text-muted-foreground text-sm">الأرباح</p>
            <p className="text-2xl font-semibold">{formatBudgetSAR(String(stats.collected))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-right">
            <p className="text-muted-foreground text-sm">المستحق</p>
            <p className="text-2xl font-semibold">{formatBudgetSAR(String(stats.outstanding))}</p>
          </CardContent>
        </Card>
        </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row-reverse sm:items-center sm:gap-4">
        <form onSubmit={handleSearchSubmit} className="w-full flex-1 sm:max-w-sm">
          <Input
            dir="rtl"
            name="search"
            placeholder="البحث برقم الفاتورة أو اسم العميل..."
            defaultValue={searchParam}
            className="w-full text-right"
          />
        </form>
        <Select value={dateRangeParam} onValueChange={(v) => updateParams({ dateRange: v })}>
          <SelectTrigger className="w-full text-right sm:w-[160px]">
            <SelectValue placeholder="الفترة" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusParam} onValueChange={(v) => updateParams({ status: v })}>
          <SelectTrigger className="w-full text-right sm:w-[160px]">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Mobile: invoice cards */}
      <div className="space-y-2 md:hidden">
        {invoices.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">لا توجد فواتير تطابق التصفية.</p>
        ) : (
          invoices.map((inv) => (
            <div key={inv.id} className="rounded-xl border p-4 space-y-2">
              <div className="flex justify-between items-center">
                <InvoiceStatusBadge
                  invoiceId={inv.id}
                  status={inv.status}
                  invoiceNumber={inv.invoiceNumber}
                  onRequestMarkAsPaid={(invoice) => setPayDialogInvoice(invoice)}
                />
                <span className="font-bold">{inv.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{formatDateDDMMYYYY(inv.issueDate)}</span>
                <span className="font-medium">{formatBudgetSAR(inv.total)}</span>
              </div>
              <p className="text-sm">{inv.clientName ?? "—"}</p>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" asChild className="flex-1">
                  <Link href={`/dashboard/invoices/${inv.id}`}>عرض</Link>
                </Button>
                {inv.status === "pending" && (
                  <Button variant="outline" size="sm" onClick={() => setPayDialogInvoice({ id: inv.id, invoiceNumber: inv.invoiceNumber })}>
                    تحديد كمدفوعة
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Card className="hidden md:block">
        <CardContent className="pt-0">
          <div className="overflow-x-auto" dir="rtl">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="pb-3 pe-4 font-medium text-right">رقم الفاتورة</th>
                  <th className="pb-3 pe-4 font-medium text-right">العميل</th>
                  <th className="pb-3 pe-4 font-medium text-right">المشروع</th>
                  <th className="pb-3 pe-4 font-medium text-right">المبلغ</th>
                  <th className="pb-3 pe-4 font-medium text-right">الحالة</th>
                  <th className="pb-3 pe-4 font-medium text-right">تاريخ الإصدار</th>
                  <th className="pb-3 w-10 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-3 pe-4 text-right">
                      <Link href={`/dashboard/invoices/${inv.id}`} className="font-medium hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="py-3 pe-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={inv.clientLogoUrl ?? undefined} />
                          <AvatarFallback className="text-xs">
                            {(inv.clientName ?? "?").slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        {inv.clientName ?? "—"}
                      </div>
                    </td>
                    <td className="py-3 pe-4 text-right">{inv.projectName ?? "—"}</td>
                    <td className="py-3 pe-4 text-right">{formatBudgetSAR(inv.total)}</td>
                    <td className="py-3 pe-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <InvoiceStatusBadge
                          invoiceId={inv.id}
                          status={inv.status}
                          invoiceNumber={inv.invoiceNumber}
                          onRequestMarkAsPaid={(invoice) => setPayDialogInvoice(invoice)}
                        />
                        {inv.status === "paid" && inv.paidAt && (
                          <span className="text-muted-foreground text-xs">
                            تاريخ الدفع: {formatDateDDMMYYYY(inv.paidAt instanceof Date ? inv.paidAt.toISOString().slice(0, 10) : String(inv.paidAt).slice(0, 10))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pe-4 text-right">{formatDateDDMMYYYY(inv.issueDate)}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-start">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <DotsHorizontalIcon className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/invoices/${inv.id}`}>عرض</Link>
                            </DropdownMenuItem>
                            {inv.status === "pending" && (
                              <>
                                <DropdownMenuItem onSelect={() => setPayDialogInvoice({ id: inv.id, invoiceNumber: inv.invoiceNumber })}>
                                  تحديد كمدفوعة
                                </DropdownMenuItem>
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/invoices/${inv.id}/edit`}>تعديل</Link>
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={(e) => {
                                e.preventDefault();
                                setInvoiceToDelete({ id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status });
                              }}
                            >
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {invoices.length === 0 && (
            <p className="py-8 text-center text-muted-foreground text-sm">لا توجد فواتير تطابق التصفية.</p>
          )}
        </CardContent>
      </Card>
      <AlertDialog open={!!invoiceToDelete} onOpenChange={(open) => !open && setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              {invoiceToDelete
                ? `سيتم حذف الفاتورة ${invoiceToDelete.invoiceNumber} نهائياً. لا يمكن التراجع عن هذا الإجراء.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (!invoiceToDelete) return;
                const id = invoiceToDelete.id;
                setInvoiceToDelete(null);
                const res = await deleteInvoice(id);
                if (res.ok) {
                  toast.success("تم حذف الفاتورة");
                  router.refresh();
                } else {
                  toast.error(res.error);
                }
              }}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MarkAsPaidDialog
        invoiceId={payDialogInvoice?.id ?? ""}
        invoiceNumber={payDialogInvoice?.invoiceNumber}
        open={!!payDialogInvoice}
        onOpenChange={(open) => !open && setPayDialogInvoice(null)}
        onSuccess={() => router.refresh()}
      />

      <button
        type="button"
        className="md:hidden fixed bottom-24 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg text-2xl"
        aria-label="فاتورة جديدة"
        onClick={() => setNewInvoiceOpen(true)}
      >
        +
      </button>
    </div>
  );
}
