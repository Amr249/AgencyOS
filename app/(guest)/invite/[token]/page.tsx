import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getInvitationByToken } from "@/actions/invitations";
import { InviteAcceptForm } from "@/components/invite/invite-accept-form";
import { Button } from "@/components/ui/button";
import { LanguageToggle } from "@/components/language-toggle";

type PageProps = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: PageProps) {
  const { token } = await params;
  const lookup = await getInvitationByToken(token);
  const t = await getTranslations("invitations");
  if (lookup.kind === "valid") {
    return { title: t("metaValidTitle", { org: lookup.organizationName }) };
  }
  return { title: t("metaInvalidTitle") };
}

export default async function InviteTokenPage({ params }: PageProps) {
  const { token } = await params;
  const lookup = await getInvitationByToken(token);
  const t = await getTranslations("invitations");
  const tAuth = await getTranslations("auth");

  if (lookup.kind === "valid") {
    return (
      <InviteAcceptForm
        token={token}
        email={lookup.email}
        organizationName={lookup.organizationName}
        inviterName={lookup.inviterName}
        role={lookup.role}
      />
    );
  }

  const message =
    lookup.kind === "expired"
      ? t("expiredMessage")
      : lookup.kind === "used"
        ? t("usedMessage")
        : t("notFoundMessage");

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <span className="text-sm font-medium text-neutral-800">{t("inviteHeader")}</span>
        <LanguageToggle />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md space-y-6 rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-neutral-900">{t("unavailableTitle")}</h1>
          <p className="text-sm text-neutral-600">{message}</p>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/login">{tAuth("loginButton")}</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
