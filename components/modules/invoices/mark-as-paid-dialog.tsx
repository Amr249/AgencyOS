"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { markAsPaid } from "@/actions/invoices";
import { toast } from "sonner";
import { PAYMENT_METHOD_LABELS } from "@/types";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";
import { enUS } from "date-fns/locale";

const PAYMENT_METHOD_VALUES = ["bank_transfer", "cash", "credit_card", "cheque", "other"] as const;

type MarkAsPaidDialogProps = {
  invoiceId: string;
  invoiceNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Remaining balance that will be recorded as one payment (invoice total − prior payments). */
  remainingAmountSar?: number;
};

export function MarkAsPaidDialog({
  invoiceId,
  invoiceNumber,
  open,
  onOpenChange,
  onSuccess,
  remainingAmountSar,
}: MarkAsPaidDialogProps) {
  const router = useRouter();
  const [paidAt, setPaidAt] = React.useState<Date | undefined>(() => new Date());
  const [paymentMethod, setPaymentMethod] = React.useState<string>("other");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setPaidAt(new Date());
      setPaymentMethod("other");
    }
  }, [open]);

  const handleConfirm = async () => {
    setLoading(true);
    const paidAtStr = paidAt
      ? `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, "0")}-${String(paidAt.getDate()).padStart(2, "0")}T12:00:00.000Z`
      : new Date().toISOString();
    const res = await markAsPaid({
      id: invoiceId,
      paidAt: paidAtStr,
      paymentMethod,
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Payment recorded successfully");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } else {
      const err = (res as { error?: unknown }).error;
      const msg = typeof err === "string" ? err : (err as { _form?: string[] })?._form?.[0] ?? "Failed to record payment";
      toast.error(msg);
    }
  };

  const formattedAmount =
    remainingAmountSar != null && Number.isFinite(remainingAmountSar)
      ? remainingAmountSar.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="ltr">
        <DialogHeader className="text-left">
          <DialogTitle>Record Full Payment</DialogTitle>
          <DialogDescription className="text-left">
            {invoiceNumber ? <>Invoice {invoiceNumber}</> : null}
            {invoiceNumber ? <br /> : null}
            Enter the payment date and method. The remaining balance will be recorded as a single payment that closes the
            invoice.
          </DialogDescription>
        </DialogHeader>
        {formattedAmount ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-dashed border-primary/30 bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">This will record a payment of</span>
            <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
              {formattedAmount}
              <SarCurrencyIcon className="h-4 w-4 shrink-0" />
            </span>
          </div>
        ) : null}
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label className="text-left">Payment Date</Label>
            <DatePickerAr
              popoverAlign="start"
              direction="ltr"
              locale={enUS}
              value={paidAt}
              onChange={setPaidAt}
              placeholder="Pick a date"
            />
          </div>
          <div className="grid gap-2">
            <Label className="text-left">Payment Method (optional)</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="text-left">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHOD_VALUES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
