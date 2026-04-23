"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  deactivateClientUser,
  disableClientPortal,
  enableClientPortal,
  inviteClientUser,
  setClientPortalUserPassword,
} from "@/actions/client-portal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

export type ClientPortalUserRow = {
  id: string;
  clientId: string;
  email: string;
  name: string | null;
  isActive: boolean;
  lastLoginAt: Date | string | null;
  invitedAt: Date | string | null;
  createdAt: Date | string;
};

function fmtTs(value: Date | string | null | undefined, locale: string): string {
  if (value == null) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

type Props = {
  clientId: string;
  initialPortalEnabled: boolean;
  initialUsers: ClientPortalUserRow[];
  isRtl?: boolean;
};

export function ClientPortalAccess({ clientId, initialPortalEnabled, initialUsers, isRtl = false }: Props) {
  const t = useTranslations("clients");
  const router = useRouter();
  const [portalEnabled, setPortalEnabled] = React.useState(initialPortalEnabled);
  const [users, setUsers] = React.useState(initialUsers);
  const [togglePending, setTogglePending] = React.useState(false);
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteName, setInviteName] = React.useState("");
  const [invitePassword, setInvitePassword] = React.useState("");
  const [inviteSaving, setInviteSaving] = React.useState(false);
  const [deactivateId, setDeactivateId] = React.useState<string | null>(null);
  const [pwdUserId, setPwdUserId] = React.useState<string | null>(null);
  const [pwdValue, setPwdValue] = React.useState("");
  const [pwdSaving, setPwdSaving] = React.useState(false);

  React.useEffect(() => {
    setPortalEnabled(initialPortalEnabled);
  }, [initialPortalEnabled]);

  React.useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  const locale = isRtl ? "ar" : "en";

  async function onPortalToggle(checked: boolean) {
    setTogglePending(true);
    try {
      const res = checked ? await enableClientPortal(clientId) : await disableClientPortal(clientId);
      if (!res.ok) {
        toast.error(typeof res.error === "string" ? res.error : t("portalToggleError"));
        return;
      }
      setPortalEnabled(checked);
      toast.success(checked ? t("portalEnabledToast") : t("portalDisabledToast"));
      router.refresh();
    } finally {
      setTogglePending(false);
    }
  }

  async function onInviteSubmit() {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      toast.error(t("portalInviteRequired"));
      return;
    }
    setInviteSaving(true);
    try {
      const pwdTrim = invitePassword.trim();
      const res = await inviteClientUser({
        clientId,
        email: inviteEmail.trim(),
        name: inviteName.trim(),
        ...(pwdTrim.length >= 8 ? { initialPassword: pwdTrim } : {}),
      });
      if (!res.ok) {
        const err = res.error;
        const msg =
          typeof err === "string"
            ? err
            : err && typeof err === "object"
              ? Object.values(err as Record<string, string[] | undefined>)
                  .flat()
                  .filter(Boolean)
                  .join(" ")
              : t("portalInviteError");
        toast.error(msg || t("portalInviteError"));
        return;
      }
      setUsers((prev) => [...prev, res.data]);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      toast.success(t("portalInviteSuccess"));
      router.refresh();
    } finally {
      setInviteSaving(false);
    }
  }

  async function confirmSetPassword() {
    if (!pwdUserId || pwdValue.trim().length < 8) {
      toast.error(t("portalPasswordMin"));
      return;
    }
    setPwdSaving(true);
    try {
      const res = await setClientPortalUserPassword({
        clientUserId: pwdUserId,
        password: pwdValue.trim(),
      });
      if (!res.ok) {
        toast.error(typeof res.error === "string" ? res.error : t("portalPasswordSetError"));
        return;
      }
      setPwdUserId(null);
      setPwdValue("");
      toast.success(t("portalPasswordSetSuccess"));
      router.refresh();
    } finally {
      setPwdSaving(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateId) return;
    const res = await deactivateClientUser(deactivateId);
    if (!res.ok) {
      toast.error(typeof res.error === "string" ? res.error : t("portalDeactivateError"));
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === deactivateId ? { ...u, isActive: false } : u))
    );
    setDeactivateId(null);
    toast.success(t("portalDeactivateSuccess"));
    router.refresh();
  }

  return (
    <Card dir={isRtl ? "rtl" : "ltr"}>
      <CardHeader className={isRtl ? "text-right" : "text-left"}>
        <CardTitle>{t("portalSectionTitle")}</CardTitle>
        <CardDescription>{t("portalSectionDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
            isRtl ? "sm:flex-row-reverse" : ""
          }`}
        >
          <div className={`space-y-1 ${isRtl ? "text-right" : "text-left"}`}>
            <Label htmlFor="portal-enabled" className="text-base">
              {t("portalEnableLabel")}
            </Label>
            <p className="text-muted-foreground text-sm">{t("portalEnableHint")}</p>
          </div>
          <Switch
            id="portal-enabled"
            checked={portalEnabled}
            disabled={togglePending}
            onCheckedChange={(c) => void onPortalToggle(c)}
          />
        </div>

        <div className={`flex items-center justify-between gap-2 ${isRtl ? "flex-row-reverse" : ""}`}>
          <h3 className="text-sm font-medium">{t("portalUsersTitle")}</h3>
          <Button type="button" size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
            <UserPlus className="size-4" />
            {t("portalInviteUser")}
          </Button>
        </div>

        {users.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("portalNoUsers")}</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={isRtl ? "text-right" : "text-left"}>{t("portalColName")}</TableHead>
                  <TableHead className={isRtl ? "text-right" : "text-left"}>{t("portalColEmail")}</TableHead>
                  <TableHead className={isRtl ? "text-right" : "text-left"}>{t("portalColStatus")}</TableHead>
                  <TableHead className={isRtl ? "text-right" : "text-left"}>{t("portalColLastLogin")}</TableHead>
                  <TableHead className={isRtl ? "text-right" : "text-left"}>{t("portalColInvited")}</TableHead>
                  <TableHead className={`w-[180px] ${isRtl ? "text-right" : "text-left"}`}>
                    {t("portalColActions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.isActive ? "default" : "secondary"}>
                        {u.isActive ? t("portalStatusActive") : t("portalStatusInactive")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {fmtTs(u.lastLoginAt, locale)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm tabular-nums">
                      {fmtTs(u.invitedAt, locale)}
                    </TableCell>
                    <TableCell>
                      <div className={`flex flex-wrap gap-1 ${isRtl ? "justify-end" : "justify-start"}`}>
                        {u.isActive ? (
                          <>
                            <Button type="button" variant="outline" size="sm" onClick={() => setPwdUserId(u.id)}>
                              {t("portalSetPassword")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setDeactivateId(u.id)}
                            >
                              {t("portalDeactivate")}
                            </Button>
                          </>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className={isRtl ? "text-right" : "text-left"} dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader className={isRtl ? "text-right" : "text-left"}>
            <DialogTitle>{t("portalInviteDialogTitle")}</DialogTitle>
            <DialogDescription>{t("portalInviteDialogDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="invite-email">{t("portalInviteEmail")}</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-name">{t("portalInviteName")}</Label>
              <Input
                id="invite-name"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder={t("portalInviteNamePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invite-password">{t("portalInvitePasswordOptional")}</Label>
              <Input
                id="invite-password"
                type="password"
                autoComplete="new-password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                placeholder={t("portalInvitePasswordPlaceholder")}
              />
              <p className="text-muted-foreground text-xs">{t("portalInvitePasswordHint")}</p>
            </div>
          </div>
          <DialogFooter className={isRtl ? "flex-row-reverse sm:justify-start" : ""}>
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={inviteSaving} onClick={() => void onInviteSubmit()}>
              {t("portalInviteSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pwdUserId} onOpenChange={(o) => !o && setPwdUserId(null)}>
        <DialogContent className={isRtl ? "text-right" : "text-left"} dir={isRtl ? "rtl" : "ltr"}>
          <DialogHeader className={isRtl ? "text-right" : "text-left"}>
            <DialogTitle>{t("portalSetPasswordTitle")}</DialogTitle>
            <DialogDescription>{t("portalSetPasswordDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="portal-new-pwd">{t("portalNewPassword")}</Label>
            <Input
              id="portal-new-pwd"
              type="password"
              autoComplete="new-password"
              value={pwdValue}
              onChange={(e) => setPwdValue(e.target.value)}
            />
          </div>
          <DialogFooter className={isRtl ? "flex-row-reverse sm:justify-start" : ""}>
            <Button type="button" variant="outline" onClick={() => setPwdUserId(null)}>
              {t("cancel")}
            </Button>
            <Button type="button" disabled={pwdSaving} onClick={() => void confirmSetPassword()}>
              {t("portalSetPasswordSubmit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deactivateId} onOpenChange={(o) => !o && setDeactivateId(null)}>
        <AlertDialogContent dir={isRtl ? "rtl" : "ltr"}>
          <AlertDialogHeader className={isRtl ? "text-right" : "text-left"}>
            <AlertDialogTitle>{t("portalDeactivateConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("portalDeactivateConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={isRtl ? "flex-row-reverse" : ""}>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void confirmDeactivate()}
            >
              {t("portalDeactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
