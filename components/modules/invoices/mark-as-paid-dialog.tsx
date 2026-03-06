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

const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "تحويل بنكي" },
  { value: "cash", label: "نقداً" },
  { value: "credit_card", label: "بطاقة ائتمان" },
  { value: "other", label: "أخرى" },
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
      toast.success("تم تسجيل الدفعة بنجاح");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } else {
      const err = (res as { error?: unknown }).error;
      const msg = typeof err === "string" ? err : (err as { _form?: string[] })?._form?.[0] ?? "فشل";
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>تأكيد استلام الدفعة</DialogTitle>
          <DialogDescription>أدخل تاريخ استلام الدفعة لهذه الفاتورة{invoiceNumber ? ` (${invoiceNumber})` : ""}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>تاريخ الدفع</Label>
            <DatePickerAr
              value={paidAt}
              onChange={setPaidAt}
              placeholder="اختر تاريخًا"
            />
          </div>
          <div className="grid gap-2">
            <Label>طريقة الدفع (اختياري)</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="text-right">
                <SelectValue placeholder="اختر طريقة الدفع" />
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
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleConfirm} disabled={loading}>
            تأكيد الدفع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
