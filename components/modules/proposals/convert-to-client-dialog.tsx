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
      toast.success("Client and project created successfully.");
      router.push(`/dashboard/clients/${result.data.clientId}`);
    } else {
      toast.error(result.error ?? "Could not create client");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir="ltr">
        <AlertDialogHeader>
          <AlertDialogTitle>Convert proposal to client</AlertDialogTitle>
          <AlertDialogDescription>
            Create a new client from this proposal? A linked project will be created as well.
            {proposalTitle && (
              <span className="mt-2 block font-medium text-foreground">
                Name: {proposalTitle}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading}>
            {loading ? "Creating…" : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
