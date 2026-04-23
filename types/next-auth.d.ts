import "next-auth";
import type { DefaultSession } from "next-auth";

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
  }
}
