"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_BADGE_CLASS } from "@/types";
import { updateProposalStatus } from "@/actions/proposals";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

const PROPOSAL_STATUS_OPTIONS = [
  { value: "applied" as const, label: "مُقدَّم", dotClass: "bg-blue-500" },
  { value: "viewed" as const, label: "تمت المشاهدة", dotClass: "bg-amber-500" },
  { value: "shortlisted" as const, label: "في القائمة المختصرة", dotClass: "bg-purple-500" },
  { value: "won" as const, label: "تم الفوز", dotClass: "bg-green-500" },
  { value: "lost" as const, label: "لم يُكسب", dotClass: "bg-red-500" },
  { value: "cancelled" as const, label: "ملغي", dotClass: "bg-gray-500" },
] as const;

type ProposalStatusBadgeProps = {
  proposalId: string;
  status: string;
  onStatusChange?: (newStatus: string) => void;
  className?: string;
};

export function ProposalStatusBadge({
  proposalId,
  status,
  onStatusChange,
  className,
}: ProposalStatusBadgeProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [updating, setUpdating] = React.useState(false);
  const [optimisticStatus, setOptimisticStatus] = React.useState(status);
  const displayStatus = optimisticStatus;

  const handleSelect = async (
    newStatus: (typeof PROPOSAL_STATUS_OPTIONS)[number]["value"]
  ) => {
    if (newStatus === displayStatus) {
      setOpen(false);
      return;
    }
    setOptimisticStatus(newStatus);
    setUpdating(true);
    setOpen(false);
    const result = await updateProposalStatus(proposalId, newStatus);
    setUpdating(false);
    if (result.ok) {
      const label = PROPOSAL_STATUS_LABELS[newStatus] ?? newStatus;
      toast.success(`تم تحديث الحالة إلى ${label}`);
      onStatusChange?.(newStatus);
      router.refresh();
    } else {
      setOptimisticStatus(status);
      toast.error(result.error ?? "فشل تحديث الحالة");
    }
  };

  const label = PROPOSAL_STATUS_LABELS[displayStatus] ?? displayStatus;
  const isWon = displayStatus === "won";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-0.5 rounded-full border px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-90",
            PROPOSAL_STATUS_BADGE_CLASS[displayStatus] ?? "bg-muted",
            className
          )}
          onClick={(e) => e.stopPropagation()}
          disabled={updating}
        >
          {label}
          {isWon && " 🎉"}
          <ChevronDown className="h-3 w-3 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="end" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col">
          {PROPOSAL_STATUS_OPTIONS.map((opt) => (
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
