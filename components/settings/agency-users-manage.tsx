"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
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
import {
  deactivateClientUser,
  enableClientPortal,
  inviteClientUser,
  listAllClientPortalUsers,
  listClientsForPortalInvite,
  setClientPortalUserPassword,
  type ClientInviteOptionRow,
  type ClientPortalUserListRow,
} from "@/actions/client-portal";
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
import { Badge } from "@/components/ui/badge";
import { useLocale, useTranslations } from "next-intl";



type AgencyUsersManageProps = {
  currentUserId: string;
  /** When true, show a link back to main settings (dedicated users page). */
  showBackLink?: boolean;
};

export function AgencyUsersManage({ currentUserId, showBackLink }: AgencyUsersManageProps) {
  const router = useRouter();
  const t = useTranslations("settings.users");
  const te = useTranslations("errors");
  const tAuth = useTranslations("auth");
  const locale = useLocale();
  const pageDir = locale === "ar" ? "rtl" : "ltr";

  const mapActionError = React.useCallback(
    (code: string) => {
      switch (code) {
        case "forbidden":
          return t("errors.forbidden");
        case "unauthorized":
          return t("errors.unauthorized");
        case "validation":
          return t("errors.validation");
        case "email_exists":
          return t("errors.email_exists");
        case "last_admin":
          return t("errors.last_admin");
        case "self_delete":
          return t("errors.self_delete");
        case "team_member_not_found":
          return t("errors.teamMemberNotFound");
        case "team_member_no_email":
          return t("errors.teamMemberNoEmail");
        case "team_member_already_linked":
          return t("errors.teamMemberAlreadyLinked");
        case "starter_team_limit":
          return t("errors.starter_team_limit");
        case "connectionTimeout":
          return te("connectionTimeout");
        case "fetchFailed":
          return te("fetchFailed");
        case "unknown":
          return t("errors.unknown");
        default:
          return t("errors.unknown");
      }
    },
    [t, te]
  );

  const formatClientInviteError = React.useCallback(
    (err: unknown): string => {
      if (typeof err === "string") {
        if (
          err === "connectionTimeout" ||
          err === "fetchFailed" ||
          err === "unauthorized" ||
          err === "forbidden"
        ) {
          return mapActionError(err);
        }
        return err;
      }
      if (err && typeof err === "object") {
        const values = Object.values(err as Record<string, string[] | undefined>)
          .flat()
          .filter(Boolean);
        if (values.length) return values.join(" ");
      }
      return t("errors.unknown");
    },
    [mapActionError, t]
  );

  const fmtPortalTs = React.useCallback(
    (value: Date | string | null | undefined): string => {
      if (value == null) return "—";
      const d = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(d.getTime())) return "—";
      return d.toLocaleString(locale === "ar" ? "ar" : "en-US", {
        dateStyle: "short",
        timeStyle: "short",
      });
    },
    [locale]
  );

  const [rows, setRows] = React.useState<AgencyUserRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [portalRows, setPortalRows] = React.useState<ClientPortalUserListRow[]>([]);
  const [portalLoading, setPortalLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);

  const [newName, setNewName] = React.useState("");
  const [newEmail, setNewEmail] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [newRole, setNewRole] = React.useState<"admin" | "member">("member");
  const [userKind, setUserKind] = React.useState<"team" | "client">("team");
  const [addMode, setAddMode] = React.useState<"manual" | "team_member">("manual");
  const [clientAddMode, setClientAddMode] = React.useState<"pick" | "manual">("pick");
  const [clientsList, setClientsList] = React.useState<ClientInviteOptionRow[]>([]);
  const [clientsLoading, setClientsLoading] = React.useState(false);
  const [selectedClientId, setSelectedClientId] = React.useState("");
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

  const [deactivatePortalId, setDeactivatePortalId] = React.useState<string | null>(null);
  const [deactivatingPortal, setDeactivatingPortal] = React.useState(false);
  const [portalPwdOpen, setPortalPwdOpen] = React.useState(false);
  const [portalPwdUserId, setPortalPwdUserId] = React.useState<string | null>(null);
  const [portalPwdValue, setPortalPwdValue] = React.useState("");
  const [showPortalPwd, setShowPortalPwd] = React.useState(false);
  const [portalPwdSaving, setPortalPwdSaving] = React.useState(false);

  const refreshUsers = React.useCallback(async () => {
    const res = await listAgencyUsers();
    if (res.ok) {
      setRows(res.data);
    } else {
      toast.error(mapActionError(res.error));
    }
  }, [mapActionError]);

  const refreshPortalUsers = React.useCallback(async () => {
    const res = await listAllClientPortalUsers();
    if (res.ok) {
      setPortalRows(res.data);
    } else {
      toast.error(mapActionError(res.error));
    }
  }, [mapActionError]);

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
  }, [mapActionError]);

  const loadClients = React.useCallback(async () => {
    setClientsLoading(true);
    try {
      const res = await listClientsForPortalInvite();
      if (res.ok) {
        setClientsList(res.data);
      } else {
        toast.error(mapActionError(res.error));
      }
    } finally {
      setClientsLoading(false);
    }
  }, [mapActionError]);

  React.useEffect(() => {
    void loadInvitees();
  }, [loadInvitees]);

  React.useEffect(() => {
    if (userKind !== "client") return;
    void loadClients();
  }, [userKind, loadClients]);

  function applyClientPrefill(clientId: string) {
    const c = clientsList.find((x) => x.id === clientId);
    if (!c) return;
    const name =
      (c.contactName?.trim() && c.contactName.trim()) ||
      c.companyName.trim();
    const email = (c.contactEmail?.trim() && c.contactEmail.trim()) || "";
    setNewName(name);
    setNewEmail(email);
  }

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setPortalLoading(true);
      const [usersRes, portalRes] = await Promise.all([
        listAgencyUsers(),
        listAllClientPortalUsers(),
      ]);
      if (!cancelled) {
        if (usersRes.ok) setRows(usersRes.data);
        else toast.error(mapActionError(usersRes.error));
        if (portalRes.ok) setPortalRows(portalRes.data);
        else toast.error(mapActionError(portalRes.error));
        setLoading(false);
        setPortalLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapActionError]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();

    if (userKind === "team") {
      if (addMode === "team_member") {
        if (!selectedTeamMemberId) {
          toast.error(t("pickTeamMemberError"));
          return;
        }
      }
    } else {
      if (!selectedClientId) {
        toast.error(t("pickClientError"));
        return;
      }
      if (!newName.trim() || !newEmail.trim()) {
        toast.error(t("errors.validation"));
        return;
      }
    }

    setCreating(true);
    try {
      if (userKind === "client") {
        const portalRes = await enableClientPortal(selectedClientId);
        if (!portalRes.ok) {
          const pe = portalRes.error;
          toast.error(
            typeof pe === "string"
              ? pe === "connectionTimeout" || pe === "fetchFailed"
                ? mapActionError(pe)
                : pe
              : t("errors.unknown")
          );
          return;
        }
        const pwdTrim = newPassword.trim();
        const inv = await inviteClientUser({
          clientId: selectedClientId,
          email: newEmail.trim(),
          name: newName.trim(),
          ...(pwdTrim.length >= 8 ? { initialPassword: pwdTrim } : {}),
        });
        if (inv.ok) {
          toast.success(t("createClientSuccess"));
          setNewName("");
          setNewEmail("");
          setNewPassword("");
          setSelectedClientId("");
          setClientAddMode("pick");
          await refreshPortalUsers();
          router.refresh();
        } else {
          toast.error(formatClientInviteError(inv.error));
        }
        return;
      }

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
        toast.success(t("createSuccess"));
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
      toast.success(t("roleUpdated"));
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
        toast.success(t("updateSuccess"));
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
        toast.success(t("deleteSuccess"));
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

  async function onConfirmDeactivatePortal() {
    if (!deactivatePortalId) return;
    setDeactivatingPortal(true);
    try {
      const res = await deactivateClientUser(deactivatePortalId);
      if (res.ok) {
        toast.success(t("portalDeactivateSuccess"));
        setDeactivatePortalId(null);
        await refreshPortalUsers();
        router.refresh();
      } else {
        toast.error(typeof res.error === "string" ? res.error : t("errors.unknown"));
      }
    } finally {
      setDeactivatingPortal(false);
    }
  }

  function openPortalPasswordDialog(userId: string) {
    setPortalPwdUserId(userId);
    setPortalPwdValue("");
    setShowPortalPwd(false);
    setPortalPwdOpen(true);
  }

  async function onSavePortalPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!portalPwdUserId || portalPwdValue.trim().length < 8) {
      toast.error(t("errors.validation"));
      return;
    }
    setPortalPwdSaving(true);
    try {
      const res = await setClientPortalUserPassword({
        clientUserId: portalPwdUserId,
        password: portalPwdValue.trim(),
      });
      if (res.ok) {
        toast.success(t("portalPwdSuccess"));
        setPortalPwdOpen(false);
        setPortalPwdUserId(null);
        setPortalPwdValue("");
        router.refresh();
      } else {
        const err = res.error;
        toast.error(typeof err === "string" ? err : formatClientInviteError(err));
      }
    } finally {
      setPortalPwdSaving(false);
    }
  }

  const deactivatePortalTarget = deactivatePortalId
    ? portalRows.find((r) => r.id === deactivatePortalId)
    : null;

  return (
    <div className="space-y-6">
      {showBackLink ? (
        <p className="text-muted-foreground text-sm">
          <Link href="/dashboard/settings" className="text-primary underline-offset-4 hover:underline">
            {t("backToSettings")}
          </Link>
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("addTitle")}</CardTitle>
          <CardDescription>{t("addDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="grid max-w-xl gap-4 sm:grid-cols-2">
            <div className="space-y-3 sm:col-span-2">
              <Label className="text-foreground">{t("userTypeLabel")}</Label>
              <RadioGroup
                value={userKind}
                onValueChange={(v) => {
                  const k = v as "team" | "client";
                  setUserKind(k);
                  setSelectedTeamMemberId("");
                  setSelectedClientId("");
                  setNewName("");
                  setNewEmail("");
                  setNewPassword("");
                  setAddMode("manual");
                  setClientAddMode("pick");
                }}
                className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="team" id="user-kind-team" />
                  <Label htmlFor="user-kind-team" className="cursor-pointer font-normal">
                    {t("userKindTeam")}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="client" id="user-kind-client" />
                  <Label htmlFor="user-kind-client" className="cursor-pointer font-normal">
                    {t("userKindClient")}
                  </Label>
                </div>
              </RadioGroup>
              <p className="text-muted-foreground text-sm">{t("userKindHint")}</p>
            </div>

            {userKind === "team" ? (
              <>
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
                        {t("addModeManual")}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="team_member" id="add-mode-team" />
                      <Label htmlFor="add-mode-team" className="cursor-pointer font-normal">
                        {t("addModeTeam")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {addMode === "manual" ? (
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="new-user-name">{t("name")}</Label>
                      <Input
                        id="new-user-name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                        autoComplete="name"
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="new-user-email">{t("email")}</Label>
                      <Input
                        id="new-user-email"
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        required
                        autoComplete="email"
                      />
                    </div>
                  </>
                ) : (
                  <div className="space-y-3 sm:col-span-2">
                    <div className="space-y-2">
                      <Label>{t("teamMemberLabel")}</Label>
                      {inviteesLoading ? (
                        <p className="text-muted-foreground text-sm">{t("inviteesLoading")}</p>
                      ) : invitees.length === 0 ? (
                        <p className="text-muted-foreground text-sm">{t("inviteesEmpty")}</p>
                      ) : (
                        <Select value={selectedTeamMemberId} onValueChange={setSelectedTeamMemberId}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("teamMemberPlaceholder")} />
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
                          <p className="text-muted-foreground mt-1 text-xs">{t("teamPreviewHint")}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="space-y-3 sm:col-span-2">
                  <Label className="text-foreground">How to add</Label>
                  <RadioGroup
                    value={clientAddMode}
                    onValueChange={(v) => {
                      const m = v as "pick" | "manual";
                      setClientAddMode(m);
                      if (m === "manual") {
                        setNewName("");
                        setNewEmail("");
                      } else if (selectedClientId) {
                        applyClientPrefill(selectedClientId);
                      }
                    }}
                    className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="pick" id="client-add-pick" />
                      <Label htmlFor="client-add-pick" className="cursor-pointer font-normal">
                        {t("clientAddModePick")}
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="manual" id="client-add-manual" />
                      <Label htmlFor="client-add-manual" className="cursor-pointer font-normal">
                        {t("clientAddModeManual")}
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label>{t("clientCompanyLabel")}</Label>
                  {clientsLoading ? (
                    <p className="text-muted-foreground text-sm">{t("clientsLoading")}</p>
                  ) : clientsList.length === 0 ? (
                    <p className="text-muted-foreground text-sm">{t("clientsEmpty")}</p>
                  ) : (
                    <Select
                      value={selectedClientId}
                      onValueChange={(id) => {
                        setSelectedClientId(id);
                        if (clientAddMode === "pick") {
                          applyClientPrefill(id);
                        }
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("clientPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {clientsList.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {clientAddMode === "pick" ? (
                  <p className="text-muted-foreground text-sm sm:col-span-2">{t("clientPrefillHint")}</p>
                ) : null}

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="client-user-name">{t("name")}</Label>
                  <Input
                    id="client-user-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="client-user-email">{t("email")}</Label>
                  <Input
                    id="client-user-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </>
            )}

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="new-user-password">{t("password")}</Label>
              <div className="relative" dir="ltr">
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
                  aria-label={showNewPassword ? tAuth("hidePassword") : tAuth("showPassword")}
                  title={showNewPassword ? tAuth("hidePassword") : tAuth("showPassword")}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {userKind === "team" ? (
              <div className="space-y-2 sm:col-span-2">
                <Label>{t("role")}</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as "admin" | "member")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">{t("roleMember")}</SelectItem>
                    <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex items-end sm:col-span-2">
              <Button type="submit" disabled={creating}>
                {creating ? t("creating") : t("createButton")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("listTitle")}</CardTitle>
          <CardDescription>{t("listDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : rows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("empty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead className="w-[160px]">{t("role")}</TableHead>
                  <TableHead className="w-[140px] text-end">{t("actions")}</TableHead>
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
                          <SelectItem value="member">{t("roleMember")}</SelectItem>
                          <SelectItem value="admin">{t("roleAdmin")}</SelectItem>
                        </SelectContent>
                      </Select>
                      {u.id === currentUserId ? (
                        <p className="text-muted-foreground mt-1 text-xs">{t("you")}</p>
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
                          aria-label={t("edit")}
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
                          aria-label={t("delete")}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("portalUsersTitle")}</CardTitle>
          <CardDescription>{t("portalUsersDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {portalLoading ? (
            <p className="text-muted-foreground text-sm">{t("portalLoading")}</p>
          ) : portalRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("portalEmpty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("portalColClient")}</TableHead>
                  <TableHead>{t("portalColStatus")}</TableHead>
                  <TableHead>{t("portalColLastLogin")}</TableHead>
                  <TableHead className="text-end">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portalRows.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{u.companyName}</TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "default" : "secondary"}>
                        {u.isActive ? t("portalStatusActive") : t("portalStatusInactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {fmtPortalTs(u.lastLoginAt)}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button variant="outline" size="sm" asChild>
                          <Link
                            href={`/dashboard/clients/${u.clientId}`}
                            className="inline-flex items-center gap-1.5"
                          >
                            <Building2 className="size-3.5 shrink-0" />
                            {t("portalOpenClient")}
                          </Link>
                        </Button>
                        {u.isActive ? (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openPortalPasswordDialog(u.id)}
                            >
                              {t("portalSetPassword")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeactivatePortalId(u.id)}
                            >
                              {t("portalDeactivate")}
                            </Button>
                          </>
                        ) : null}
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
        <DialogContent className="sm:max-w-md" dir={pageDir}>
          <form onSubmit={onSaveEdit}>
            <DialogHeader>
              <DialogTitle>{t("editTitle")}</DialogTitle>
              <DialogDescription>{t("editDescription")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">{t("name")}</Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">{t("email")}</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">{t("optionalNewPassword")}</Label>
                <div className="relative" dir="ltr">
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
                    aria-label={showEditPassword ? tAuth("hidePassword") : tAuth("showPassword")}
                  >
                    {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-muted-foreground text-xs">{t("optionalNewPasswordHint")}</p>
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
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={savingEdit}>
                {savingEdit ? t("saving") : t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={portalPwdOpen}
        onOpenChange={(open) => {
          setPortalPwdOpen(open);
          if (!open) {
            setPortalPwdUserId(null);
            setPortalPwdValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md" dir={pageDir}>
          <form onSubmit={onSavePortalPassword}>
            <DialogHeader>
              <DialogTitle>{t("portalPwdTitle")}</DialogTitle>
              <DialogDescription>{t("portalPwdDescription")}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="portal-new-password">{t("password")}</Label>
                <div className="relative" dir="ltr">
                  <Input
                    id="portal-new-password"
                    type={showPortalPwd ? "text" : "password"}
                    value={portalPwdValue}
                    onChange={(e) => setPortalPwdValue(e.target.value)}
                    minLength={8}
                    required
                    className="pe-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPortalPwd((v) => !v)}
                    className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 -translate-y-1/2"
                    aria-label={showPortalPwd ? tAuth("hidePassword") : tAuth("showPassword")}
                  >
                    {showPortalPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPortalPwdOpen(false);
                  setPortalPwdUserId(null);
                  setPortalPwdValue("");
                }}
              >
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={portalPwdSaving}>
                {portalPwdSaving ? t("saving") : t("portalPwdSave")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent dir={pageDir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? t("deleteConfirmDescriptionNamed", { name: deleteTarget.name })
                : t("deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                void onConfirmDelete();
              }}
            >
              {deleting ? t("deleting") : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deactivatePortalId}
        onOpenChange={(o) => !o && setDeactivatePortalId(null)}
      >
        <AlertDialogContent dir={pageDir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("portalDeactivateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivatePortalTarget
                ? `${deactivatePortalTarget.name ?? deactivatePortalTarget.email} (${deactivatePortalTarget.companyName}). ${t("portalDeactivateDescription")}`
                : t("portalDeactivateDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivatingPortal}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deactivatingPortal}
              onClick={(e) => {
                e.preventDefault();
                void onConfirmDeactivatePortal();
              }}
            >
              {deactivatingPortal ? t("deleting") : t("portalDeactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
