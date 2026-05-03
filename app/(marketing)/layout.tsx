import type { ReactNode } from "react";
import "./marketing.css";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div data-marketing-root className="flex min-h-screen flex-col bg-background text-foreground">
      <MarketingNav />
      {children}
      <MarketingFooter />
    </div>
  );
}
