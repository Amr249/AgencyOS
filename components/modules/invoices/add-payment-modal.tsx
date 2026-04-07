"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerAr } from "@/components/ui/date-picker-ar";
import { toast } from "sonner";
import { createPayment } from "@/actions/payments";
import { Loader2 } from "lucide-react";
import { PAYMENT_METHOD_LABELS } from "@/types";
import { enUS } from "date-fns/locale";

interface AddPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  amountDue: number;
  currency?: string;
}

export function AddPaymentModal({
  open,
  onOpenChange,
  invoiceId,
  amountDue,
  currency = "SAR",
}: AddPaymentModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState(amountDue.toString());
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(() => new Date());
  const [paymentMethod, setPaymentMethod] = useState<string | undefined>(undefined);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      setAmount(amountDue.toString());
      setPaymentDate(new Date());
      setPaymentMethod(undefined);
      setReference("");
      setNotes("");
    }
  }, [open, amountDue]);

  const handleSubmit = async () => {
    const n = parseFloat(amount);
    if (!amount || Number.isNaN(n) || n <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (n > amountDue + 0.0001) {
      toast.error("Amount exceeds remaining balance");
      return;
    }

    if (!paymentDate) {
      toast.error("Please select a payment date");
      return;
    }

    setLoading(true);
    try {
      const result = await createPayment({
        invoiceId,
        amount: n,
        paymentDate: paymentDate.toISOString().split("T")[0]!,
        ...(paymentMethod
          ? {
              paymentMethod: paymentMethod as
                | "bank_transfer"
                | "cash"
                | "credit_card"
                | "cheque"
                | "other",
            }
          : {}),
        reference: reference || undefined,
        notes: notes || undefined,
      });

      if (result.ok) {
        toast.success("Payment recorded successfully");
        onOpenChange(false);
        router.refresh();
      } else {
        if (typeof result.error === "object" && result.error !== null) {
          toast.error("Please check the entered fields");
        } else {
          toast.error(typeof result.error === "string" ? result.error : "Something went wrong");
        }
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir="ltr">
        <DialogHeader className="text-left">
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              max={amountDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Remaining: ${amountDue.toLocaleString("en-US")} ${currency}`}
              className="text-left"
            />
            <p className="text-muted-foreground text-left text-xs">
              Remaining: {amountDue.toLocaleString("en-US")} {currency}
            </p>
          </div>

          <div className="grid gap-2">
            <Label className="text-left">Payment Date</Label>
            <DatePickerAr
              direction="ltr"
              locale={enUS}
              value={paymentDate}
              onChange={setPaymentDate}
              placeholder="Pick a date"
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-left">Payment Method</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="text-left">
                <SelectValue placeholder="Select payment method" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reference">Reference (optional)</Label>
            <Input
              id="reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Transfer reference, cheque number…"
              className="text-left"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes…"
              rows={2}
              className="text-left"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
