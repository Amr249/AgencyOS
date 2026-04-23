"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function PortalShell({
  children,
  clientName,
}: {
  children: React.ReactNode;
  clientName?: string | null;
}) {
  const pathname = usePathname();
  if (pathname === "/portal/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
          <Link href="/portal" className="font-semibold tracking-tight hover:underline">
            {clientName?.trim() ? clientName : "Client portal"}
          </Link>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link href="/portal" className="text-muted-foreground hover:text-foreground">
              Home
            </Link>
            <Link href="/portal/projects" className="text-muted-foreground hover:text-foreground">
              Projects
            </Link>
            <Link href="/portal/invoices" className="text-muted-foreground hover:text-foreground">
              Invoices
            </Link>
            <Link href="/portal/progress" className="text-muted-foreground hover:text-foreground">
              Progress
            </Link>
            <Link href="/portal/files" className="text-muted-foreground hover:text-foreground">
              Files
            </Link>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => signOut({ callbackUrl: "/portal/login" })}
            >
              Sign out
            </Button>
          </nav>
        </div>
      </header>
      <div className="flex-1">{children}</div>
    </div>
  );
}
