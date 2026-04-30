import type { ReactNode } from "react";

export default function MemberDriveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-var(--header-height)-6rem)] max-h-[calc(100dvh-var(--header-height)-6rem)] min-h-0 flex-1 flex-col overflow-hidden md:h-[calc(100dvh-var(--header-height)-3.5rem)] md:max-h-[calc(100dvh-var(--header-height)-3.5rem)]">
      {children}
    </div>
  );
}
