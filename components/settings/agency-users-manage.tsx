"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createAgencyUser,
  deleteAgencyUser,
  listAgencyUsers,
  listTeamMembersForUserInvite,
  updateAgencyUser,
  updateAgencyUserRole,
  type AgencyUserRow,
  type TeamMemberInviteRow,
} from "@/actions/agency-users";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

/** English copy for settings → users (matches former en.json `settings.users`). */
const U = {
  showPassword: "Show password",
  hidePassword: "Hide password",
  backToSettings: "Back to settings",
  addTitle: "Add user",
  addDescription:
    "Create a dashboard login manually, or pick an active team member who does not already have an account. Team roster data fills name, photo, and email; you only set a password.",
  addModeManual: "Enter details manually",
  addModeTeam: "Choose from team",
  teamMemberLabel: "Team member",
  teamMemberPlaceholder: "Select a team member…",
  teamPreviewHint: "Name, email, and photo come from the team roster.",
  inviteesLoading: "Loading team roster…",
  inviteesEmpty:
    "No eligible team members (need an email, no login yet, and email not already used for a user).",
  pickTeamMemberError: "Please select a team member.",
  team_member_not_found: "That team member was not found.",
  team_member_no_email: "That team member has no email on file.",
  team_member_already_linked: "That team member already has a dashboard login.",
  name: "Name",
  email: "Email",
  password: "Password",
  role: "Role",
  roleMember: "Member",
  roleAdmin: "Admin",
  createButton: "Create user",
  creating: "Creating…",
  createSuccess: "User created. They can sign in with the email and password you set.",
  roleUpdated: "Role updated.",
  listTitle: "Users",
  listDescription:
    "Change a user’s role (admin = full dashboard; member = personal hub only).",
  loading: "Loading users…",
  empty: "No users yet.",
  you: "You",
  actions: "Actions",
  edit: "Edit user",
  delete: "Delete user",
  editTitle: "Edit user",
  editDescription: "Update name, email, or set a new password.",
  optionalNewPassword: "New password",
  optionalNewPasswordHint: "Leave blank to keep the current password.",
  cancel: "Cancel",
  saving: "Saving…",
  saveChanges: "Save changes",
  updateSuccess: "User updated.",
  deleteSuccess: "User removed.",
  deleting: "Deleting…",
  deleteConfirmTitle: "Delete this user?",
  deleteConfirmDescription:
    "This will remove their dashboard access. This cannot be undone.",
  deleteConfirmDescriptionNamed: (name: string) =>
    `This will remove dashboard access for ${name}. This cannot be undone.`,
  errors: {
    forbidden: "You don’t have permission.",
    unauthorized: "Please sign in again.",
    validation: "Check all fields (password at least 8 characters).",
    email_exists: "A user with this email already exists.",
    last_admin: "Keep at least one admin account.",
    self_delete: "You can’t delete your own account here.",
    unknown: "Something went wrong.",
  },
  globalErrors: {
    connectionTimeout: "Database connection timed out. Please try again.",
    fetchFailed: "Failed to fetch data. Check your connection.",
  },
} as const;

function mapActionError(code: string): string {
  switch (code) {
    case "forbidden":
      return U.errors.forbidden;
    case "unauthorized":
      return U.errors.unauthorized;
    case "validation":
      return U.errors.validation;
    case "email_exists":
      return U.errors.email_exists;
    case "last_admin":
      return U.errors.last_admin;
    case "self_delete":
      return U.errors.self_delete;
    case "team_member_not_found":
      return U.team_member_not_found;
    case "team_member_no_email":
      return U.team_member_no_email;
    case "team_member_already_linked":
      return U.team_member_already_linked;
    case "connectionTimeout":
      return U.globalErrors.connectionTimeout;
    case "fetchFailed":
      return U.globalErrors.fetchFailed;
    case "unknown":
      return U.errors.unknown;
    default:
      return U.errors.unknown;
  }
}

type AgencyUsersManageProps = {
  currentUserId: string;
  /** When true, show a link back to main settings (dedicated users page). */
  showBackLink?: boolean;
};

export function AgencyUsersManage({ currentUserId, showBackLink }: AgencyUsersManageProps) {
  const router = useRouter();
  const [rows, setRows] = React.useState<AgencyUserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);

  const [newName, setNewName] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [newRole, setNewRole] = React.useState<"admin" | "member">("member");
  const [addMode, setAddMode] = React.useState<"manual" | "team_member">("manual");
  const [invitees, setInvitees] = React.useState<TeamMemberInviteRow[]>([]);
  const [inviteesLoading, setInviteesLoading] = React.useState(false);
  const [selectedTeamMemberId, setSelectedTeamMemberId] = React.useState("");

  const [editOpen, setEditOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AgencyUserRow | null>(null);
  const [editName, setEditName] = React.useState("");
  const [editEmail, setEditEmail] = React.useState("");
  const [editPassword, setEditPassword] = React.useState("");
  const [showEditPassword, setShowEditPassword] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);

  const [deleteId, setDeleteId] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const refreshUsers = React.useCallback(async () => {
    const res = await listAgencyUsers();
    if (res.ok) {
      setRows(res.data);
    } else {
      toast.error(mapActionError(res.error));
    }
  }, []);

  const loadInvitees = React.useCallback(async () => {
    setInviteesLoading(true);
    try {
      const res = await listTeamMembersForUserInvite();
      if (res.ok) {
        setInvitees(res.data);
      } else {
        toast.error(mapActionError(res.error));
      }
    } finally {
      setInviteesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadInvitees();
  }, [loadInvitees]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await listAgencyUsers();
      if (!cancelled) {
        if (res.ok) setRows(res.data);
        else toast.error(mapActionError(res.error));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (addMode === "team_member") {
      if (!selectedTeamMemberId) {
        toast.error(U.pickTeamMemberError);
        return;
      }
    }
    setCreating(true);
    try {
      const res =
        addMode === "manual"
          ? await createAgencyUser({
              source: "manual",
              name: newName,
              email: newEmail,
              password: newPassword,
              role: newRole,
            })
          : await createAgencyUser({
              source: "team_member",
              teamMemberId: selectedTeamMemberId,
              password: newPassword,
              role: newRole,
            });
      if (res.ok) {
        toast.success(U.createSuccess);
        setNewName("");
        setNewEmail("");
        setNewPassword("");
        setNewRole("member");
        setSelectedTeamMemberId("");
        await refreshUsers();
        await loadInvitees();
        router.refresh();
      } else {
        toast.error(mapActionError(res.error));
      }
    } finally {
      setCreating(false);
    }
  }

  const selectedInvitee = invitees.find((m) => m.id === selectedTeamMemberId);

  function initialsFromName(name: string) {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?";
  }

  async function onRoleChange(userId: string, role: "admin" | "member") {
    const res = await updateAgencyUserRole({ userId, role });
    if (res.ok) {
      toast.success(U.roleUpdated);
      setRows((prev) => prev.map((r) => (r.id === userId ? { ...r, role } : r)));
      router.refresh();
    } else {
      toast.error(mapActionError(res.error));
    }
  }

  function openEdit(u: AgencyUserRow) {
    setEditing(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditPassword("");
    setShowEditPassword(true);
    setEditOpen(true);
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      const res = await updateAgencyUser({
        userId: editing.id,
        name: editName,
        email: editEmail,
        password: editPassword.trim() || undefined,
      });
      if (res.ok) {
        toast.success(U.updateSuccess);
        setEditOpen(false);
        setEditing(null);
        await refreshUsers();
        router.refresh();
      } else {
        toast.error(mapActionError(res.error));
      }
    } finally {
      setSavingEdit(false);
    }
  }

  async function onConfirmDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const res = await deleteAgencyUser(deleteId);
      if (res.ok) {
        toast.success(U.deleteSuccess);
        setDeleteId(null);
        await refreshUsers();
        router.refresh();
      } else {
        toast.error(mapActionError(res.error));
      }
    } finally {
      setDeleting(false);
    }
  }

  const deleteTarget = deleteId ? rows.find((r) => r.id === deleteId) : null;

  return (
    <div className="space-y-6">
      {showBackLink ? (
        <p className="text-muted-foreground text-sm">
          <Link href="/dashboard/settings" className="text-primary underline-offset-4 hover:underline">
            {U.backToSettings}
          </Link>
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{U.addTitle}</CardTitle>
          <CardDescription>{U.addDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid max-w-xl gap-4 sm:grid-cols-2">
            <div className="space-y-3 sm:col-span-2">
              <Label className="text-foreground">How to add</Label>
              <RadioGroup
                value={addMode}
                onValueChange={(v) => {
                  setAddMode(v as "manual" | "team_member");
                  setSelectedTeamMemberId("");
                }}
                className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manual" id="add-mode-manual" />
                  <Label htmlFor="add-mode-manual" className="cursor-pointer font-normal">
                    {U.addModeManual}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="team_member" id="add-mode-team" />
                  <Label htmlFor="add-mode-team" className="cursor-pointer font-normal">
                    {U.addModeTeam}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {addMode === "manual" ? (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="new-user-name">{U.name}</Label>
                  <Input
                    id="new-user-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required={addMode === "manual"}
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="new-user-email">{U.email}</Label>
                  <Input
                    id="new-user-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required={addMode === "manual"}
                    autoComplete="email"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-3 sm:col-span-2">
                <div className="space-y-2">
                  <Label>{U.teamMemberLabel}</Label>
                  {inviteesLoading ? (
                    <p className="text-muted-foreground text-sm">{U.inviteesLoading}</p>
                  ) : invitees.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{U.inviteesEmpty}</p>
                  ) : (
                    <Select value={selectedTeamMemberId} onValueChange={setSelectedTeamMemberId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={U.teamMemberPlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {invitees.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name} — {m.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {selectedInvitee ? (
                  <div className="flex items-center gap-3 rounded-lg border p-3">
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={selectedInvitee.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback>{initialsFromName(selectedInvitee.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium leading-tight">{selectedInvitee.name}</p>
                      <p className="text-muted-foreground truncate text-sm" dir="ltr">
                        {selectedInvitee.email}
                      </p>
                      <p className="text-muted-foreground mt-1 text-xs">{U.teamPreviewHint}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-user-password">{U.password}</Label>
              <div className="relative">
                <Input
                  id="new-user-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
                  aria-label={showNewPassword ? U.hidePassword : U.showPassword}
                  title={showNewPassword ? U.hidePassword : U.showPassword}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{U.role}</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "member")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{U.roleMember}</SelectItem>
                  <SelectItem value="admin">{U.roleAdmin}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" disabled={creating}>
                {creating ? U.creating : U.createButton}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{U.listTitle}</CardTitle>
          <CardDescription>{U.listDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{U.loading}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{U.empty}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{U.name}</TableHead>
                  <TableHead>{U.email}</TableHead>
                  <TableHead className="w-[160px]">{U.role}</TableHead>
                  <TableHead className="w-[140px] text-end">{U.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Select
                        value={u.role}
                        onValueChange={(v) => onRoleChange(u.id, v as "admin" | "member")}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">{U.roleMember}</SelectItem>
                          <SelectItem value="admin">{U.roleAdmin}</SelectItem>
                        </SelectContent>
                      </Select>
                      {u.id === currentUserId ? (
                        <p className="text-muted-foreground mt-1 text-xs">{U.you}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEdit(u)}
                          aria-label={U.edit}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive h-8 w-8"
                          disabled={u.id === currentUserId}
                          onClick={() => setDeleteId(u.id)}
                          aria-label={U.delete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditing(null);
        }}
      >
        <DialogContent className="sm:max-w-md" dir="ltr" lang="en">
          <form onSubmit={onSaveEdit}>
            <DialogHeader>
              <DialogTitle>{U.editTitle}</DialogTitle>
              <DialogDescription>{U.editDescription}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{U.name}</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">{U.email}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">{U.optionalNewPassword}</Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={showEditPassword ? "text" : "password"}
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    minLength={8}
                    className="pe-10"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditPassword((v) => !v)}
                    className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
                    aria-label={showEditPassword ? U.hidePassword : U.showPassword}
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-muted-foreground text-xs">{U.optionalNewPasswordHint}</p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditOpen(false);
                  setEditing(null);
                }}
              >
                {U.cancel}
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? U.saving : U.saveChanges}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent dir="ltr" lang="en">
          <AlertDialogHeader>
            <AlertDialogTitle>{U.deleteConfirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? U.deleteConfirmDescriptionNamed(deleteTarget.name)
                : U.deleteConfirmDescription}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{U.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void onConfirmDelete();
              }}
            >
              {deleting ? U.deleting : U.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
