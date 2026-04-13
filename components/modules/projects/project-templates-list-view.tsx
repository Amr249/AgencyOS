"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { deleteProjectTemplate } from "@/actions/project-templates";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export type ProjectTemplateListRow = {
  id: string;
  name: string;
  description: string | null;
  defaultPhases: string[];
  createdAt: Date;
  sourceProjectId: string | null;
};

type Props = {
  templates: ProjectTemplateListRow[];
};

export function ProjectTemplatesListView({ templates }: Props) {
  const router = useRouter();
  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function confirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const result = await deleteProjectTemplate(deleteId);
      if (!result.ok) {
        toast.error(typeof result.error === "string" ? result.error : "Delete failed");
        return;
      }
      toast.success("Template deleted");
      setDeleteId(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project templates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Reusable phase and task structures saved from projects. Use them when creating new
            projects (apply flow can be added next).
          </p>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center text-muted-foreground text-sm">
            No templates yet. Open a project and choose &quot;Save as template&quot; to create one.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Phases</TableHead>
                  <TableHead className="hidden sm:table-cell">Created</TableHead>
                  <TableHead className="w-[100px] text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/templates/${t.id}`}
                        className="font-medium hover:underline"
                      >
                        {t.name}
                      </Link>
                      {t.description ? (
                        <p className="text-muted-foreground text-xs mt-0.5 line-clamp-2">
                          {t.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {t.defaultPhases?.length
                        ? `${t.defaultPhases.length}: ${t.defaultPhases.join(" → ")}`
                        : "—"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground text-sm whitespace-nowrap">
                      {format(new Date(t.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/dashboard/templates/${t.id}`}>View</Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          aria-label="Delete template"
                          onClick={() => setDeleteId(t.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the template and all of its task rows. Projects already created are not
              affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
