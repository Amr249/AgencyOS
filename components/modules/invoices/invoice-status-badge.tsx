"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_BADGE_CLASS } from "@/types";
import { updateInvoiceStatus } from "@/actions/invoices";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Check } from "lucide-react";

const INVOICE_STATUS_OPTIONS = [
  { value: "pending" as const, label: "بانتظار الدفع", dotClass: "bg-amber-500" },
  { value: "paid" as const, label: "تم الدفع", dotClass: "bg-green-500" },
] as const;

type InvoiceStatusBadgeProps = {
  invoiceId: string;
  status: string;
  /** Optional: when user selects "تم الدفع", open payment dialog instead of updating status directly */
  onRequestMarkAsPaid?: (invoice: { id: string; invoiceNumber: string }) => void;
  /** Required when onRequestMarkAsPaid is used (e.g. in list view) */
  invoiceNumber?: string;
  /** Optional: callback after status change (e.g. to update local state in list) */
  onStatusChange?: (newStatus: string) => void;
  /** Optional: size variant */
  className?: string;
};

export function InvoiceStatusBadge({
  invoiceId,
  status,
  onRequestMarkAsPaid,
  invoiceNumber,
  onStatusChange,
  className,
}: InvoiceStatusBadgeProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);
  const [optimisticStatus, setOptimisticStatus] = React.useState(status);

  const displayStatus = optimisticStatus;

  const handleSelect = async (newStatus: "pending" | "paid") => {
    if (newStatus === displayStatus) {
      setOpen(false);
      return;
    }
    if (newStatus === "paid" && onRequestMarkAsPaid) {
      setOpen(false);
      onRequestMarkAsPaid({ id: invoiceId, invoiceNumber: invoiceNumber ?? invoiceId });
      return;
    }
    setOptimisticStatus(newStatus);
    setUpdating(true);
    setOpen(false);
    const result = await updateInvoiceStatus(invoiceId, newStatus);
    setUpdating(false);
    if (result.ok) {
      toast.success("تم تحديث حالة الفاتورة");
      onStatusChange?.(newStatus);
      router.refresh();
    } else {
      setOptimisticStatus(status);
      toast.error(result.error ?? "فشل تحديث الحالة");
    }
  };

  const label = INVOICE_STATUS_LABELS[displayStatus] ?? displayStatus;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-90",
            INVOICE_STATUS_BADGE_CLASS[displayStatus] ?? "bg-muted",
            className
          )}
          onClick={(e) => e.stopPropagation()}
          disabled={updating}
        >
          {label}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-1" align="end" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col">
          {INVOICE_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={updating}
              onClick={() => handleSelect(opt.value)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-right text-sm hover:bg-accent",
                opt.value === displayStatus && "bg-accent font-medium"
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", opt.dotClass)} />
              {opt.label}
              {opt.value === displayStatus && <Check className="me-0 h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
