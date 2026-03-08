"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { IconDotsVertical, IconPencil, IconTrash } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { SortableDataTable } from "@/components/ui/sortable-data-table";
import { NewMemberModal } from "@/components/modules/team/new-member-modal";
import { deleteTeamMember, type TeamMemberWithProjectCount } from "@/actions/team";
import { toast } from "sonner";

type TeamListViewProps = {
  members: TeamMemberWithProjectCount[];
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function TeamListView({ members }: TeamListViewProps) {
  const router = useRouter();
  const [editingMember, setEditingMember] = React.useState<TeamMemberWithProjectCount | null>(null);
  const [memberToDelete, setMemberToDelete] = React.useState<TeamMemberWithProjectCount | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const handleDelete = async () => {
    if (!memberToDelete) return;
    setDeleting(true);
    const result = await deleteTeamMember(memberToDelete.id);
    setDeleting(false);
    setMemberToDelete(null);
    if (result.ok) {
      toast.success("تم حذف العضو");
      router.refresh();
    } else {
      toast.error(result.error ?? "فشل الحذف");
    }
  };

  const refresh = () => router.refresh();
  const [view, setView] = React.useState<"cards" | "table">("cards");

  const teamTableColumns = React.useMemo<ColumnDef<TeamMemberWithProjectCount>[]>(
    () => [
      { id: "drag", header: () => null, cell: () => null, enableSorting: false, size: 32 },
      {
        accessorKey: "name",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الاسم {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <Link href={`/dashboard/team/${row.original.id}`} className="flex items-center gap-3 no-underline min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={row.original.avatarUrl ?? undefined} alt={row.original.name} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">{getInitials(row.original.name)}</AvatarFallback>
            </Avatar>
            <span className="font-bold truncate">{row.original.name}</span>
          </Link>
        ),
      },
      {
        accessorKey: "role",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الدور {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.role ?? "—"}</span>,
      },
      {
        accessorKey: "phone",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الهاتف {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => <span dir="ltr">{row.original.phone ?? "—"}</span>,
      },
      {
        accessorKey: "status",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">الحالة {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "active" ? "default" : "secondary"}
            className={row.original.status === "active" ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {row.original.status === "active" ? "نشط" : "غير نشط"}
          </Badge>
        ),
      },
      {
        accessorKey: "projectCount",
        enableSorting: true,
        header: ({ column }) => (
          <Button variant="ghost" className="-ms-3 flex w-full justify-end gap-1 flex-row-reverse" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
            <span className="text-right">المشاريع {column.getIsSorted() === "asc" ? "↑" : column.getIsSorted() === "desc" ? "↓" : "↕"}</span>
          </Button>
        ),
        cell: ({ row }) => <span className="text-muted-foreground text-sm">{row.original.projectCount} مشروع</span>,
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => {
          const member = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <IconDotsVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setEditingMember(member)}>
                  <IconPencil className="me-2 h-4 w-4" />تعديل
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setMemberToDelete(member)}>
                  <IconTrash className="me-2 h-4 w-4" />حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    []
  );

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">الفريق</h1>
        <div className="flex items-center gap-2">
          <Button variant={view === "cards" ? "secondary" : "ghost"} size="sm" onClick={() => setView("cards")}>
            بطاقات
          </Button>
          <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setView("table")}>
            جدول
          </Button>
          <NewMemberModal
            trigger={<Button variant="secondary" className="w-full sm:w-auto">+ إضافة عضو</Button>}
            asChild
            onSuccess={refresh}
          />
        </div>
      </div>
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground mb-4">لا يوجد أعضاء في الفريق بعد. أضف أول عضو.</p>
          <NewMemberModal
            trigger={<Button>+ إضافة عضو</Button>}
            asChild
            onSuccess={refresh}
          />
        </div>
      ) : view === "table" ? (
        <Card>
          <CardContent className="pt-4">
            <SortableDataTable<TeamMemberWithProjectCount>
              columns={teamTableColumns}
              data={members}
              tableId="team-table"
              getRowId={(m) => m.id}
              columnLabels={{
                name: "الاسم",
                role: "الدور",
                phone: "الهاتف",
                status: "الحالة",
                projectCount: "المشاريع",
              }}
              enablePagination={false}
            />
          </CardContent>
        </Card>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {members.map((member) => (
          <Card key={member.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/dashboard/team/${member.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3 no-underline"
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold truncate">{member.name}</p>
                    {member.role && (
                      <p className="text-muted-foreground text-sm truncate">{member.role}</p>
                    )}
                  </div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                      <IconDotsVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setEditingMember(member)}>
                      <IconPencil className="me-2 h-4 w-4" />
                      تعديل
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setMemberToDelete(member)}
                    >
                      <IconTrash className="me-2 h-4 w-4" />
                      حذف
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {member.phone && (
                <p className="text-muted-foreground mt-2 text-sm" dir="ltr">
                  {member.phone}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge
                  variant={member.status === "active" ? "default" : "secondary"}
                  className={member.status === "active" ? "bg-green-600 hover:bg-green-700" : ""}
                >
                  {member.status === "active" ? "نشط" : "غير نشط"}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  {member.projectCount} مشروع
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      )}

      <NewMemberModal
        trigger={<span className="sr-only" />}
        member={editingMember ?? undefined}
        open={!!editingMember}
        onOpenChange={(open) => !open && setEditingMember(null)}
        onSuccess={() => {
          setEditingMember(null);
          refresh();
        }}
      />
      <AlertDialog open={!!memberToDelete} onOpenChange={(o) => !o && setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف عضو الفريق</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف {memberToDelete?.name}؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
