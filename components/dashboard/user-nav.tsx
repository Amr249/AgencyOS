"use client";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function UserNav() {
  const { data: session } = useSession();
  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  if (!session?.user) return null;

  const name = session.user.name ?? "";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  const roleLabel =
    (session.user as { role?: string }).role === "admin" ? t("admin") : t("member");

  return (
    <div className="flex items-center gap-3 border-t border-border px-3 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-2">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={(session.user as { avatarUrl?: string | null }).avatarUrl ?? undefined} />
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 text-end group-data-[collapsible=icon]:hidden">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{roleLabel}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => signOut({ callbackUrl: "/login" })}
        title={tAuth("logout")}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </Button>
    </div>
  );
}
