import { getAppSiteUrl } from "@/lib/app-site-url";

/** Absolute invite URL for sharing (admin copy, resend, onboarding). */
export function getInvitationPublicUrl(token: string): string {
  const base =
    process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    getAppSiteUrl();
  return `${base}/invite/${token}`;
}
