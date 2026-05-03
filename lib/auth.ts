import type { NextAuthOptions } from "next-auth";
import type { Session } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clientUsers, clients, orgMembers, organizations, users } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";
import { fetchOrganizationSnapshot } from "@/lib/org-snapshot";

const JWT_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: JWT_MAX_AGE_SEC },
  jwt: { maxAge: JWT_MAX_AGE_SEC },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      /** Agency users (`users`) first; otherwise client portal (`client_users`). Same `/login` form for both. */
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        const [agencyUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (agencyUser) {
          const valid = await bcrypt.compare(password, agencyUser.passwordHash);
          if (!valid) return null;

          const [membership] = await db
            .select({
              organizationId: orgMembers.organizationId,
              orgRole: orgMembers.role,
              plan: organizations.plan,
              orgName: organizations.name,
            })
            .from(orgMembers)
            .innerJoin(organizations, eq(orgMembers.organizationId, organizations.id))
            .where(eq(orgMembers.userId, agencyUser.id))
            .orderBy(desc(orgMembers.joinedAt))
            .limit(1);

          if (!membership) return null;

          return {
            id: agencyUser.id,
            name: agencyUser.name,
            email: agencyUser.email,
            role: agencyUser.role,
            avatarUrl: agencyUser.avatarUrl,
            organizationId: membership.organizationId,
            orgName: membership.orgName,
            plan: membership.plan,
            orgRole: membership.orgRole,
          };
        }

        const [cu] = await db
          .select({
            id: clientUsers.id,
            clientId: clientUsers.clientId,
            email: clientUsers.email,
            name: clientUsers.name,
            passwordHash: clientUsers.passwordHash,
            isActive: clientUsers.isActive,
          })
          .from(clientUsers)
          .where(eq(clientUsers.email, email))
          .limit(1);

        if (!cu?.isActive || !cu.passwordHash) return null;

        const validPortal = await bcrypt.compare(password, cu.passwordHash);
        if (!validPortal) return null;

        const [cl] = await db
          .select({
            portalEnabled: clients.portalEnabled,
            organizationId: clients.organizationId,
          })
          .from(clients)
          .where(and(eq(clients.id, cu.clientId), isNull(clients.deletedAt)))
          .limit(1);

        if (!cl?.portalEnabled) return null;

        const [org] = await db
          .select({ plan: organizations.plan, orgName: organizations.name })
          .from(organizations)
          .where(eq(organizations.id, cl.organizationId))
          .limit(1);

        await db.update(clientUsers).set({ lastLoginAt: new Date() }).where(eq(clientUsers.id, cu.id));

        return {
          id: cu.id,
          name: cu.name ?? cu.email,
          email: cu.email,
          role: "client_portal",
          avatarUrl: null,
          clientId: cu.clientId,
          organizationId: cl.organizationId,
          orgName: org?.orgName?.trim() || "Organization",
          plan: org?.plan ?? "starter",
          orgRole: "member" as const,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        const u = user as unknown as {
          role: string;
          avatarUrl: string | null;
          name?: string | null;
          email?: string | null;
          clientId?: string | null;
          organizationId?: string;
          orgName?: string;
          plan?: string;
          orgRole?: string;
        };
        token.role = u.role;
        token.avatarUrl = u.avatarUrl;
        token.clientId = u.clientId ?? null;
        if (u.name != null) token.name = u.name;
        if (u.email != null) token.email = u.email;
        if (u.organizationId) token.organizationId = u.organizationId;
        if (u.orgName) token.orgName = u.orgName;
        if (u.plan) token.plan = u.plan;
        if (u.orgRole) token.orgRole = u.orgRole;

        if (u.role === "client_portal") {
          token.hasSeenWelcome = true;
        } else {
          const [welcomeRow] = await db
            .select({ hasSeenWelcome: users.hasSeenWelcome })
            .from(users)
            .where(eq(users.id, user.id))
            .limit(1);
          token.hasSeenWelcome = welcomeRow?.hasSeenWelcome ?? false;
        }
      }
      if (trigger === "update" && session?.user) {
        const u = session.user as {
          name?: string | null;
          email?: string | null;
          avatarUrl?: string | null;
          hasSeenWelcome?: boolean;
        };
        if (u.name != null) token.name = u.name;
        if (u.email != null) token.email = u.email;
        if (u.avatarUrl !== undefined) token.avatarUrl = u.avatarUrl;
        if (typeof u.hasSeenWelcome === "boolean") {
          token.hasSeenWelcome = u.hasSeenWelcome;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.name = (token.name as string | undefined) ?? session.user.name ?? "";
        session.user.email = (token.email as string | undefined) ?? session.user.email ?? "";
        session.user.role = token.role as string;
        session.user.avatarUrl = token.avatarUrl as string | null;
        session.user.clientId = (token.clientId as string | undefined) ?? null;
        session.user.organizationId = token.organizationId as string;
        session.user.plan = token.plan as "starter" | "pro" | "enterprise" | "internal";
        session.user.orgRole = token.orgRole as "owner" | "admin" | "member";
        session.user.orgName = (token.orgName as string | undefined) ?? "";
        (session.user as { image?: string }).image = (token.avatarUrl as string) ?? undefined;

        const orgId = token.organizationId as string | undefined;
        if (orgId) {
          let snap: Awaited<ReturnType<typeof fetchOrganizationSnapshot>> = null;
          try {
            snap = await fetchOrganizationSnapshot(orgId);
          } catch (snapErr) {
            console.error("[auth.session] fetchOrganizationSnapshot threw", { orgId, snapErr });
          }
          if (snap) {
            session.user.orgName = snap.orgName;
            session.user.orgLogoUrl = snap.orgLogoUrl;
            session.user.plan = snap.plan as typeof session.user.plan;
            session.user.orgFeatures = snap.features;
            session.user.aiUsageCount = snap.aiUsageCount;
            session.user.storageUsedBytes = snap.storageUsedBytes;
            session.user.aiUsageResetAt = snap.aiUsageResetAt
              ? snap.aiUsageResetAt.toISOString()
              : null;
            session.user.trialEndsAt = snap.trialEndsAt ? snap.trialEndsAt.toISOString() : null;
          } else {
            session.user.orgLogoUrl = null;
            session.user.orgFeatures = {};
            session.user.aiUsageCount = 0;
            session.user.storageUsedBytes = 0;
            session.user.aiUsageResetAt = null;
            session.user.trialEndsAt = null;
          }
        } else {
          session.user.orgLogoUrl = null;
          session.user.orgFeatures = {};
          session.user.aiUsageCount = 0;
          session.user.storageUsedBytes = 0;
          session.user.aiUsageResetAt = null;
          session.user.trialEndsAt = null;
        }

        session.user.hasSeenWelcome =
          token.role === "client_portal"
            ? true
            : typeof token.hasSeenWelcome === "boolean"
              ? token.hasSeenWelcome
              : true;
      }

      return session;
    },
  },
};

/** API routes & server code: session from cookies (no redirect). */
export async function auth(): Promise<Session | null> {
  return getServerSession(authOptions);
}
