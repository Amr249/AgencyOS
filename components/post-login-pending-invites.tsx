"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { applyPendingInvitationsAfterLogin } from "@/actions/invitations";

/**
 * After dashboard load the session cookie is reliable; applies pending org invites
 * (same as legacy login flow, without racing the first signIn response).
 */
export function PostLoginPendingInvites() {
  const { status } = useSession();
  const t = useTranslations("auth");
  const ran = useRef(false);

  useEffect(() => {
    if (status !== "authenticated" || ran.current) return;
    ran.current = true;

    void (async () => {
      const inviteResult = await applyPendingInvitationsAfterLogin();
      if (!inviteResult.ok) return;
      if (inviteResult.addedTo.length === 0) return;
      if (inviteResult.addedTo.length === 1) {
        toast.success(t("invitationJoinedOne", { org: inviteResult.addedTo[0]! }));
      } else {
        toast.success(t("invitationJoinedMany", { orgs: inviteResult.addedTo.join(", ") }));
      }
    })();
  }, [status, t]);

  return null;
}
