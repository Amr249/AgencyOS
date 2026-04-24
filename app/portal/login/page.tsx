import { redirect } from "next/navigation";

type Search = { callbackUrl?: string | string[] };

export default async function PortalLoginPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const raw = q.callbackUrl;
  const v = Array.isArray(raw) ? raw[0] : raw;
  const safe =
    v && v.startsWith("/") && !v.startsWith("//") && v.startsWith("/portal") ? v : "/portal";
  redirect(`/login?callbackUrl=${encodeURIComponent(safe)}`);
}
