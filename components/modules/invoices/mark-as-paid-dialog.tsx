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
import { enUS } from "date-fns/locale";

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
  { value: "other", label: "Other" },
] as const;

type MarkAsPaidDialogProps = {
  invoiceId: string;
  invoiceNumber?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function MarkAsPaidDialog({
  invoiceId,
  invoiceNumber,
  open,
  onOpenChange,
  onSuccess,
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
      paymentMethod: paymentMethod as "bank_transfer" | "cash" | "credit_card" | "other",
    });
    setLoading(false);
    if (res.ok) {
      toast.success("Payment recorded");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } else {
      const err = (res as { error?: unknown }).error;
      const msg = typeof err === "string" ? err : (err as { _form?: string[] })?._form?.[0] ?? "Failed";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="ltr">
        <DialogHeader className="text-left">
          <DialogTitle>Confirm payment</DialogTitle>
          <DialogDescription>
            Enter the payment date for this invoice{invoiceNumber ? ` (${invoiceNumber})` : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Payment date</Label>
            <DatePickerAr
              direction="ltr"
              locale={enUS}
              popoverAlign="start"
              value={paidAt}
              onChange={setPaidAt}
              placeholder="Pick a date"
            />
          </div>
          <div className="grid gap-2">
            <Label>Payment method (optional)</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="text-left">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
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
            Confirm payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
