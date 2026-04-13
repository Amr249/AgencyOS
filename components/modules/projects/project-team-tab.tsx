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
      toast.error("Select a team member");
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
      toast.success("Member assigned");
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
      toast.success("Member removed");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="space-y-4" dir="ltr" lang="en">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Team</h2>
          <p className="text-muted-foreground text-sm">Members assigned to this project</p>
        </div>
        <Button onClick={() => setAssignOpen(true)} disabled={availableMembers.length === 0}>
          + Assign Member
        </Button>
      </div>

      {members.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 py-12 text-center text-muted-foreground">
          No members assigned yet. Click &quot;Assign Member&quot; to add a team member.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Role on Project</th>
                <th className="px-4 py-3 font-medium w-[100px]" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 shrink-0">
                        <AvatarImage src={m.memberAvatarUrl ?? undefined} />
                        <AvatarFallback className="text-sm">
                          {(m.memberName ?? "?").slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{m.memberName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.memberRole ?? "—"}</td>
                  <td className="px-4 py-3">{m.roleOnProject ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setRemoveTarget(m)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md" dir="ltr" lang="en">
          <DialogHeader className="text-left">
            <DialogTitle>Assign team member</DialogTitle>
            <DialogDescription>
              Choose a team member and add them to this project. You can optionally set their role on
              the project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="block text-sm font-medium">Team member</label>
              <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select member" />
                </SelectTrigger>
                <SelectContent>
                  {availableMembers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} — {m.role ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium">Role on project (optional)</label>
              <Input
                placeholder="e.g. Frontend developer"
                value={roleOnProject}
                onChange={(e) => setRoleOnProject(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={assigning || !selectedMemberId}>
              {assigning ? "Assigning…" : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent dir="ltr" lang="en">
          <AlertDialogHeader className="text-left">
            <AlertDialogTitle>Remove member from project</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.memberName} from this project? They can be reassigned later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
