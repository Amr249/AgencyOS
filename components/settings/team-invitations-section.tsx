"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cancelInvitation, createSingleInvitation, getOrgInvitations, resendInvitation } from "@/actions/invitations";
import { getInvitationPublicUrl } from "@/lib/invitation-url";
import type { OrgInvitationRow } from "@/actions/invitations";
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

/** Serializable rows passed from the settings server page to this client component. */
export type OrgInvitationRowProps = Omit<OrgInvitationRow, "createdAt" | "expiresAt"> & {
  createdAt: string;
  expiresAt: string;
};

type TeamInvitationsSectionProps = {
  initialInvitations: OrgInvitationRowProps[];
};

export function TeamInvitationsSection({ initialInvitations }: TeamInvitationsSectionProps) {
  const router = useRouter();
  const t = useTranslations("invitations.settings");
  const tStatus = useTranslations("invitations.status");
  const tRole = useTranslations("onboarding.roleLabel");
  const [rows, setRows] = useState(initialInvitations);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    setRows(initialInvitations);
  }, [initialInvitations]);

  function normalizeRows(data: OrgInvitationRow[]): OrgInvitationRowProps[] {
    return data.map((r) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      expiresAt: r.expiresAt instanceof Date ? r.expiresAt.toISOString() : String(r.expiresAt),
    }));
  }

  async function refreshList() {
    const res = await getOrgInvitations();
    if (res.ok) setRows(normalizeRows(res.data));
    router.refresh();
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await createSingleInvitation({ email: email.trim(), role });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("inviteCreated"));
      setEmail("");
      await refreshList();
      try {
        await navigator.clipboard.writeText(res.inviteLink);
        toast.success(t("linkCopied"));
      } catch {
        /* clipboard optional */
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancel(id: string) {
    setBusyId(id);
    try {
      const res = await cancelInvitation(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("cancelled"));
      await refreshList();
    } finally {
      setBusyId(null);
    }
  }

  async function onResend(id: string) {
    setBusyId(id);
    try {
      const res = await resendInvitation(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t("resent"));
      try {
        await navigator.clipboard.writeText(res.inviteLink);
        toast.success(t("linkCopied"));
      } catch {
        /* optional */
      }
      await refreshList();
    } finally {
      setBusyId(null);
    }
  }

  function copyToken(tok: string) {
    void navigator.clipboard.writeText(getInvitationPublicUrl(tok)).then(
      () => toast.success(t("linkCopied")),
      () => toast.error(t("copyFailed"))
    );
  }

  return (
    <section>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <form onSubmit={onInvite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="invite-member-email">{t("emailLabel")}</Label>
              <Input
                id="invite-member-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                required
                dir="ltr"
              />
            </div>
            <div className="grid w-full gap-2 sm:w-40">
              <Label>{t("roleLabel")}</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "member")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">{tRole("member")}</SelectItem>
                  <SelectItem value="admin">{tRole("admin")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={submitting} className="sm:mb-0.5">
              {submitting ? t("inviting") : t("inviteButton")}
            </Button>
          </form>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colEmail")}</TableHead>
                  <TableHead>{t("colRole")}</TableHead>
                  <TableHead>{t("colSent")}</TableHead>
                  <TableHead>{t("colExpires")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead className="text-end">{t("colActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground h-24 text-center text-sm">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium" dir="ltr">
                        {row.email}
                      </TableCell>
                      <TableCell>{tRole(row.role)}</TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {new Date(row.expiresAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span>{tStatus(row.status)}</span>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => copyToken(row.token)}
                          >
                            {t("copyLink")}
                          </Button>
                          {row.status === "pending" ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                disabled={busyId === row.id}
                                onClick={() => void onResend(row.id)}
                              >
                                {t("resend")}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                disabled={busyId === row.id}
                                onClick={() => void onCancel(row.id)}
                              >
                                {t("cancel")}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
