import { getServerSession } from "next-auth";
import { getLocale, getTranslations } from "next-intl/server";
import { getOrgInvitations } from "@/actions/invitations";
import { getTags } from "@/actions/client-tags";
import { authOptions } from "@/lib/auth";
import { getCachedOrganization } from "@/lib/org-snapshot";
import type { OrgInvitationRowProps } from "@/components/settings/team-invitations-section";
import { SettingsContent } from "./settings-content";

export async function generateMetadata() {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

export default async function SettingsPage() {
  const tagsResult = await getTags();
  const initialTags = tagsResult.ok ? tagsResult.data : [];
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";
  const org =
    session?.user?.organizationId != null
      ? await getCachedOrganization(session.user.organizationId)
      : null;

  const canManageInvitations =
    session?.user?.orgRole === "owner" || session?.user?.orgRole === "admin";

  let initialInvitations: OrgInvitationRowProps[] = [];
  if (canManageInvitations) {
    const inv = await getOrgInvitations();
    if (inv.ok) {
      initialInvitations = inv.data.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
      }));
    }
  }

  const t = await getTranslations("settings");
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <div className="space-y-6" dir={dir} lang={locale}>
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">{t("dashboard.pageSubtitle")}</p>
      </div>
      <SettingsContent
        adminEmail={adminEmail}
        isAdmin={isAdmin}
        canManageInvitations={canManageInvitations}
        initialInvitations={initialInvitations}
        currentUserId={session?.user?.id ?? ""}
        initialClientTags={initialTags}
        usageOrg={
          org
            ? {
                plan: org.plan,
                trialEndsAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
                aiUsageCount: org.aiUsageCount,
                storageUsedBytes: org.storageUsedBytes,
                teamMemberCount: org.teamMemberCount,
              }
            : null
        }
      />
    </div>
  );
}
