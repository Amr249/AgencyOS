/**
 * AgencyOS v2 Solo — Single admin auth (NextAuth v5)
 * Credentials from env: ADMIN_EMAIL and either ADMIN_PASSWORD (plain) or ADMIN_PASSWORD_HASH (bcrypt).
 * Use ADMIN_PASSWORD for local dev; use ADMIN_PASSWORD_HASH in production.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

const adminEmail = process.env.ADMIN_EMAIL;
const adminPasswordPlain = process.env.ADMIN_PASSWORD;
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!adminEmail) {
          console.error("ADMIN_EMAIL not set");
          return null;
        }
        if (!adminPasswordPlain && !adminPasswordHash) {
          console.error("Set ADMIN_PASSWORD (plain) or ADMIN_PASSWORD_HASH (bcrypt)");
          return null;
        }
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;
        if (email !== adminEmail) return null;

        let valid: boolean;
        if (adminPasswordPlain) {
          valid = password === adminPasswordPlain;
        } else {
          valid = await bcrypt.compare(password, adminPasswordHash!);
        }
        if (!valid) return null;
        return {
          id: "admin",
          email: adminEmail,
          name: "Admin",
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  trustHost: true,
});
