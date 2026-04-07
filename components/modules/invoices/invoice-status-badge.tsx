"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { INVOICE_STATUS_BADGE_CLASS, INVOICE_STATUS_LABELS } from "@/types";
import { updateInvoiceStatus } from "@/actions/invoices";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { Check } from "lucide-react";

const INVOICE_STATUS_OPTIONS = [
  { value: "pending" as const, dotClass: "bg-amber-500" },
  { value: "partial" as const, dotClass: "bg-blue-500" },
  { value: "paid" as const, dotClass: "bg-green-500" },
] as const;

type InvoiceStatusBadgeProps = {
  invoiceId: string;
  status: string;
  /** Optional: when user selects "Paid", open payment dialog instead of updating status directly */
  onRequestMarkAsPaid?: (invoice: { id: string; invoiceNumber: string; amountDue?: number }) => void;
  /** Required when onRequestMarkAsPaid is used (e.g. in list view) */
  invoiceNumber?: string;
  /** Remaining balance (for payment dialog helper text) */
  amountDue?: number;
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
  amountDue,
  onStatusChange,
  className,
}: InvoiceStatusBadgeProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);
  const [optimisticStatus, setOptimisticStatus] = React.useState(status);

  React.useEffect(() => {
    setOptimisticStatus(status);
  }, [status]);

  const displayStatus = optimisticStatus;

  const labelFor = (s: string) => INVOICE_STATUS_LABELS[s] ?? s;

  const handleSelect = async (newStatus: "pending" | "partial" | "paid") => {
    if (newStatus === displayStatus) {
      setOpen(false);
      return;
    }
    if (newStatus === "paid" && onRequestMarkAsPaid) {
      setOpen(false);
      onRequestMarkAsPaid({
        id: invoiceId,
        invoiceNumber: invoiceNumber ?? invoiceId,
        amountDue,
      });
      return;
    }
    setOptimisticStatus(newStatus);
    setUpdating(true);
    setOpen(false);
    const result = await updateInvoiceStatus(invoiceId, newStatus);
    setUpdating(false);
    if (result.ok) {
      toast.success("Invoice status updated");
      onStatusChange?.(newStatus);
      router.refresh();
    } else {
      setOptimisticStatus(status);
      toast.error(result.error ?? "Failed to update status");
    }
  };

  const label = labelFor(displayStatus);
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
      <PopoverContent className="w-48 p-1" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col">
          {INVOICE_STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={updating}
              onClick={() => handleSelect(opt.value)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
                opt.value === displayStatus && "bg-accent font-medium"
              )}
            >
              <span className={cn("h-2 w-2 shrink-0 rounded-full", opt.dotClass)} />
              {labelFor(opt.value)}
              {opt.value === displayStatus && <Check className="ml-auto h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
