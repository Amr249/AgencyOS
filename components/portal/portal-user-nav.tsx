"use client";

import { IconBuilding } from "@tabler/icons-react";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function companyInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

export function PortalUserNav({
  clientCompanyName,
  clientLogoUrl,
}: {
  clientCompanyName: string | null;
  clientLogoUrl: string | null;
}) {
  const { data: session } = useSession();
  const tAuth = useTranslations("auth");
  if (!session?.user) return null;

  const name = session.user.name ?? "";
  const company = clientCompanyName?.trim() ?? "";
  const companyShort = companyInitials(company);

  return (
    <div className="border-t border-border">
      <div className="flex items-start gap-2 px-3 py-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-1 group-data-[collapsible=icon]:px-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive mt-0.5 h-7 w-7 shrink-0"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={tAuth("logout")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </Button>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-end group-data-[collapsible=icon]:hidden">
          <p className="text-sm font-medium wrap-anywhere whitespace-normal">{name}</p>
          {company ? (
            <p className="text-muted-foreground text-xs leading-snug wrap-anywhere whitespace-normal">{company}</p>
          ) : null}
        </div>

        <Avatar className="bg-muted/50 size-10 shrink-0 rounded-full border border-border">
          <AvatarImage
            src={clientLogoUrl ?? undefined}
            alt=""
            className="aspect-square size-full rounded-full object-contain object-center p-[14%]"
          />
          <AvatarFallback className="rounded-full text-[10px] font-medium">
            {companyShort ? (
              companyShort
            ) : (
              <IconBuilding className="text-muted-foreground size-5" aria-hidden />
            )}
          </AvatarFallback>
        </Avatar>
      </div>
    </div>
  );
}
