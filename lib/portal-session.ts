import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export type PortalSessionContext = {
  clientUserId: string;
  clientId: string;
  email: string;
  name: string | null;
};

/** Resolved only for `role === \"client_portal\"` sessions. */
export async function getPortalSession(): Promise<PortalSessionContext | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) return null;
  if ((session.user as { role?: string }).role !== "client_portal") return null;
  const clientId = session.user.clientId ?? null;
  if (!clientId) return null;
  return {
    clientUserId: session.user.id,
    clientId,
    email: session.user.email,
    name: session.user.name ?? null,
  };
}
