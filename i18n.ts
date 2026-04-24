import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";

export const locales = ["ar", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ar";

export default getRequestConfig(async () => {
  const session = await getServerSession(authOptions);
  if (sessionUserRole(session) === "member") {
    return {
      locale: "ar" satisfies Locale,
      messages: (await import("./messages/ar.json")).default,
    };
  }

  const portalRole = (session?.user as { role?: string } | undefined)?.role;
  if (portalRole === "client_portal") {
    return {
      locale: "ar" satisfies Locale,
      messages: (await import("./messages/ar.json")).default,
    };
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get("locale")?.value;
  const locale: Locale = raw === "en" ? "en" : "ar";

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
