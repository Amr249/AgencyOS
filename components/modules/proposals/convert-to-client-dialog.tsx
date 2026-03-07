"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
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
import { convertToClient } from "@/actions/proposals";
import { toast } from "sonner";

type ConvertToClientDialogProps = {
  proposalId: string | null;
  proposalTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ConvertToClientDialog({
  proposalId,
  proposalTitle,
  open,
  onOpenChange,
}: ConvertToClientDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    if (!proposalId) return;
    setLoading(true);
    const result = await convertToClient(proposalId);
    setLoading(false);
    onOpenChange(false);
    if (result.ok && result.data?.clientId) {
      toast.success("🎉 تم إنشاء العميل والمشروع بنجاح!");
      router.push(`/dashboard/clients/${result.data.clientId}`);
    } else {
      toast.error(result.error ?? "فشل إنشاء العميل");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>تحويل العرض إلى عميل</AlertDialogTitle>
          <AlertDialogDescription>
            هل تريد إنشاء عميل جديد من هذا العرض؟ سيتم إنشاء عميل ومشروع مرتبط به.
            {proposalTitle && (
              <span className="mt-2 block font-medium text-foreground">
                الاسم: {proposalTitle}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>
            {loading ? "جاري الإنشاء..." : "تأكيد"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
