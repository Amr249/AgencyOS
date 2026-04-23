import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { clientUsers, clients, users } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
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
          return {
            id: agencyUser.id,
            name: agencyUser.name,
            email: agencyUser.email,
            role: agencyUser.role,
            avatarUrl: agencyUser.avatarUrl,
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
          })
          .from(clients)
          .where(and(eq(clients.id, cu.clientId), isNull(clients.deletedAt)))
          .limit(1);

        if (!cl?.portalEnabled) return null;

        await db.update(clientUsers).set({ lastLoginAt: new Date() }).where(eq(clientUsers.id, cu.id));

        return {
          id: cu.id,
          name: cu.name ?? cu.email,
          email: cu.email,
          role: "client_portal",
          avatarUrl: null,
          clientId: cu.clientId,
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
        };
        token.role = u.role;
        token.avatarUrl = u.avatarUrl;
        token.clientId = u.clientId ?? null;
        if (u.name != null) token.name = u.name;
        if (u.email != null) token.email = u.email;
      }
      if (trigger === "update" && session?.user) {
        const u = session.user as {
          name?: string | null;
          email?: string | null;
          avatarUrl?: string | null;
        };
        if (u.name != null) token.name = u.name;
        if (u.email != null) token.email = u.email;
        if (u.avatarUrl !== undefined) token.avatarUrl = u.avatarUrl;
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
        (session.user as { image?: string }).image = (token.avatarUrl as string) ?? undefined;
      }
      return session;
    },
  },
};
