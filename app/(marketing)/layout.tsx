import type { ReactNode } from "react";
import "./marketing.css";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { SmoothScroll } from "@/components/smooth-scroll";

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <SmoothScroll>
      <div data-marketing-root className="flex min-h-screen flex-col bg-background text-foreground">
        <MarketingNav />
        {children}
        <MarketingFooter />
      </div>
    </SmoothScroll>
  );
}
