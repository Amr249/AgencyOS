import "next-auth";
import type { DefaultSession } from "next-auth";

export type OrgPlan = "starter" | "pro" | "enterprise" | "internal";
export type OrgMemberRole = "owner" | "admin" | "member";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      name: string;
      email: string;
      role: string;
      avatarUrl: string | null;
      /** Set when `role` is `client_portal` (linked `clients.id`). */
      clientId?: string | null;
      /** Active organization for agency users; client’s org for portal users. */
      organizationId: string;
      /** `organizations.name` for the active org (refreshed from DB on each session). */
      orgName: string;
      /** `organizations.logo_url` for the active org (refreshed from DB on each session). */
      orgLogoUrl: string | null;
      plan: OrgPlan;
      orgRole: OrgMemberRole;
      /** Per-tenant feature overrides (`organizations.features` JSONB). */
      orgFeatures: Record<string, unknown>;
      aiUsageCount: number;
      storageUsedBytes: number;
      /** ISO timestamp of last AI usage counter reset (billing month). */
      aiUsageResetAt: string | null;
      /** ISO end of trial when set (from `organizations.trial_ends_at`). */
      trialEndsAt: string | null;
      /** One-time dashboard welcome toast; persisted on `users.has_seen_welcome`. */
      hasSeenWelcome: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    avatarUrl?: string | null;
    name?: string;
    email?: string;
    clientId?: string | null;
    organizationId?: string;
    orgName?: string;
    orgLogoUrl?: string | null;
    plan?: string;
    orgRole?: string;
    hasSeenWelcome?: boolean;
  }
}
