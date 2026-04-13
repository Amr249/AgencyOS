"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { deleteProjectTemplate } from "@/actions/project-templates";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

type Props = {
  templateId: string;
  templateName: string;
};

export function DeleteProjectTemplateButton({ templateId, templateName }: Props) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  async function onDelete() {
    setPending(true);
    try {
      const result = await deleteProjectTemplate(templateId);
      if (!result.ok) {
        toast.error(typeof result.error === "string" ? result.error : "Delete failed");
        return;
      }
      toast.success("Template deleted");
      setOpen(false);
      router.push("/dashboard/templates");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10">
          Delete template
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{templateName}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the template and all task rows. Existing projects are not affected.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              void onDelete();
            }}
          >
            {pending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
