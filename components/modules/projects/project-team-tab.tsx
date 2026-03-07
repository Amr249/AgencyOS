"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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
import { assignMemberToProject, removeMemberFromProject } from "@/actions/team-members";
import type { ProjectMemberRow } from "@/actions/team-members";
import type { TeamMemberRow } from "@/actions/team-members";
import { toast } from "sonner";

type ProjectTeamTabProps = {
  projectId: string;
  initialMembers: ProjectMemberRow[];
  allTeamMembers: TeamMemberRow[];
};

export function ProjectTeamTab({
  projectId,
  initialMembers,
  allTeamMembers,
}: ProjectTeamTabProps) {
  const router = useRouter();
  const [members, setMembers] = React.useState<ProjectMemberRow[]>(initialMembers);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [selectedMemberId, setSelectedMemberId] = React.useState<string>("");
  const [roleOnProject, setRoleOnProject] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<ProjectMemberRow | null>(null);
  const [removing, setRemoving] = React.useState(false);

  const assignedIds = new Set(members.map((m) => m.teamMemberId));
  const availableMembers = allTeamMembers.filter((m) => !assignedIds.has(m.id));

  React.useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  const handleAssign = async () => {
    if (!selectedMemberId) {
      toast.error("اختر عضو الفريق");
      return;
    }
    setAssigning(true);
    const result = await assignMemberToProject(
      projectId,
      selectedMemberId,
      roleOnProject.trim() || null
    );
    setAssigning(false);
    if (result.ok) {
      toast.success("تم تعيين العضو");
      setAssignOpen(false);
      setSelectedMemberId("");
      setRoleOnProject("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    const result = await removeMemberFromProject(projectId, removeTarget.id);
    setRemoving(false);
    setRemoveTarget(null);
    if (result.ok) {
      toast.success("تم إزالة العضو");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">أعضاء الفريق المعينون لهذا المشروع</p>
        <Button onClick={() => setAssignOpen(true)} disabled={availableMembers.length === 0}>
          + تعيين عضو
        </Button>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 py-12 text-center text-muted-foreground">
          لا يوجد أعضاء معينون بعد. اضغط &quot;تعيين عضو&quot; لإضافة عضو الفريق.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 rounded-lg border bg-card p-4"
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={m.memberAvatarUrl ?? undefined} />
                <AvatarFallback className="text-sm">
                  {(m.memberName ?? "?").slice(0, 1)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-right">
                <p className="font-medium truncate">{m.memberName}</p>
                <p className="text-muted-foreground text-xs">
                  {m.memberRole ?? "—"}
                  {m.roleOnProject ? ` · ${m.roleOnProject}` : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setRemoveTarget(m)}
              >
                إزالة
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Assign member modal */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعيين عضو فريق</DialogTitle>
            <DialogDescription>
              اختر عضواً من الفريق وأضفه للمشروع. يمكنك تحديد دوره في المشروع اختيارياً.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-right block text-sm font-medium">عضو الفريق</label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger dir="rtl">
                  <SelectValue placeholder="اختر العضو" />
                </SelectTrigger>
                <SelectContent dir="rtl">
                  {availableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} — {m.role ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-right block text-sm font-medium">الدور في المشروع (اختياري)</label>
              <Input
                placeholder="مثال: مطور أمامي"
                value={roleOnProject}
                onChange={(e) => setRoleOnProject(e.target.value)}
                dir="rtl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAssign} disabled={assigning || !selectedMemberId}>
              {assigning ? "جاري التعيين…" : "تعيين"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>إزالة عضو من المشروع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إزالة {removeTarget?.memberName} من هذا المشروع؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "جاري الإزالة…" : "إزالة"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
