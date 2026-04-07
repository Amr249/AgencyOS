"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
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
import { Plus, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePayment, type Payment } from "@/actions/payments";
import { AddPaymentModal } from "./add-payment-modal";
import { PAYMENT_METHOD_LABELS } from "@/types";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";

interface PaymentHistoryProps {
  invoiceId: string;
  payments: Payment[];
  totalPaid: number;
  amountDue: number;
  invoiceTotal: number;
  paymentProgress: number;
  currency?: string;
  invoiceStatus: string;
}

export function PaymentHistory({
  invoiceId,
  payments,
  totalPaid,
  amountDue,
  invoiceTotal,
  paymentProgress,
  currency = "SAR",
  invoiceStatus,
}: PaymentHistoryProps) {
  const router = useRouter();
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const result = await deletePayment(deleteId);
      if (result.ok) {
        toast.success("Payment deleted");
        router.refresh();
        setDeleteId(null);
      } else {
        toast.error(typeof result.error === "string" ? result.error : "Something went wrong");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setDeleting(false);
    }
  };

  const formatAmount = (amount: string | number) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatPaymentDate = (d: string) => {
    try {
      return format(parseISO(d.length === 10 ? `${d}T12:00:00` : d), "dd/MM/yyyy", {
        locale: enUS,
      });
    } catch {
      return d;
    }
  };

  return (
    <>
      <Card dir="ltr">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-left text-lg">Payment History</CardTitle>
          {invoiceStatus !== "paid" && (
            <Button type="button" size="sm" onClick={() => setAddModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Record Payment
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Progress</span>
              <span className="font-medium">{Math.round(paymentProgress)}%</span>
            </div>
            <Progress value={Math.min(100, paymentProgress)} className="h-2" />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span className="flex items-center gap-1">
                Paid: {formatAmount(totalPaid)} <SarCurrencyIcon className="h-3 w-3" />
              </span>
              <span className="flex items-center gap-1">
                Remaining: {formatAmount(amountDue)} <SarCurrencyIcon className="h-3 w-3" />
              </span>
            </div>
            <p className="text-muted-foreground flex flex-wrap items-center gap-1 text-left text-xs">
              Invoice total: {formatAmount(invoiceTotal)}{" "}
              {currency === "SAR" ? <SarCurrencyIcon className="h-3 w-3" /> : currency}
            </p>
          </div>

          {payments.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">Date</TableHead>
                    <TableHead className="text-left">Amount</TableHead>
                    <TableHead className="text-left">Method</TableHead>
                    <TableHead className="text-left">Reference</TableHead>
                    <TableHead className="w-[50px] text-left">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-left">{formatPaymentDate(payment.paymentDate)}</TableCell>
                      <TableCell className="text-left">
                        <span className="inline-flex items-center gap-1">
                          {formatAmount(payment.amount)}
                          <SarCurrencyIcon className="h-3 w-3" />
                        </span>
                      </TableCell>
                      <TableCell className="text-left">
                        {payment.paymentMethod ? (
                          <Badge variant="outline">
                            {PAYMENT_METHOD_LABELS[payment.paymentMethod] ?? payment.paymentMethod}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-left">
                        {payment.reference || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-left">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteId(payment.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-muted-foreground py-6 text-center">No payments recorded yet</div>
          )}
        </CardContent>
      </Card>

      <AddPaymentModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        invoiceId={invoiceId}
        amountDue={amountDue}
        currency={currency}
      />

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent dir="ltr">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This payment will be permanently deleted and the invoice status will be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:justify-end">
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
