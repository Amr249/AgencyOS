"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { LanguageToggle } from "@/components/language-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export type MarketingNavMobileProps = {
  locale: string;
  features: string;
  pricing: string;
  login: string;
  signup: string;
  dashboard: string;
  portal: string;
  openMenu: string;
  languageLabel: string;
  showDashboard: boolean;
  showPortal: boolean;
};

const navLinkClass =
  "flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-white/90 transition-colors hover:bg-white/10 hover:text-white";

export function MarketingNavMobile({
  locale,
  features,
  pricing,
  login,
  signup,
  dashboard,
  portal,
  openMenu,
  languageLabel,
  showDashboard,
  showPortal,
}: MarketingNavMobileProps) {
  const sheetSide = locale === "ar" ? "left" : "right";

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 text-white hover:bg-white/10 hover:text-white md:hidden"
          aria-label={openMenu}
        >
          <Menu className="size-6" aria-hidden />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={sheetSide}
        className={cn(
          "w-[min(100%,20rem)] border-white/10 bg-black text-white sm:max-w-sm",
          "[&>button.absolute]:text-white [&>button.absolute]:hover:bg-white/10 [&>button.absolute]:hover:text-white"
        )}
      >
        <div className="flex flex-col gap-1 px-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-10">
          <SheetClose asChild>
            <Link href="#features" className={navLinkClass}>
              {features}
            </Link>
          </SheetClose>
          <SheetClose asChild>
            <Link href="#pricing" className={navLinkClass}>
              {pricing}
            </Link>
          </SheetClose>

          <div className="border-t border-white/10 px-3 py-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-white/50">{languageLabel}</p>
            <LanguageToggle />
          </div>

          <div className="mt-2 flex flex-col gap-2 border-t border-white/10 px-2 pt-4">
            {showDashboard ? (
              <SheetClose asChild>
                <Button
                  className="h-11 w-full bg-[#a4fe19] font-semibold text-black hover:bg-[#a4fe19]/90"
                  asChild
                >
                  <Link href="/dashboard">{dashboard}</Link>
                </Button>
              </SheetClose>
            ) : showPortal ? (
              <SheetClose asChild>
                <Button className="h-11 w-full" variant="secondary" asChild>
                  <Link href="/portal">{portal}</Link>
                </Button>
              </SheetClose>
            ) : (
              <>
                <SheetClose asChild>
                  <Button
                    variant="ghost"
                    className="h-11 w-full justify-center text-white hover:bg-white/10 hover:text-white"
                    asChild
                  >
                    <Link href="/login">{login}</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button
                    className="h-11 w-full bg-[#a4fe19] font-semibold text-black hover:bg-[#a4fe19]/90"
                    asChild
                  >
                    <Link href="/signup">{signup}</Link>
                  </Button>
                </SheetClose>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
