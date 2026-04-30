import type { ReactNode } from "react";

/**
 * Caps height to the visible shell (viewport − header − layout padding / mobile nav)
 * so FileManager can use flex + internal scroll instead of growing the whole page.
 */
export default function DriveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-var(--header-height)-6rem)] max-h-[calc(100dvh-var(--header-height)-6rem)] min-h-0 flex-1 flex-col overflow-hidden md:h-[calc(100dvh-var(--header-height)-3.5rem)] md:max-h-[calc(100dvh-var(--header-height)-3.5rem)]">
      {children}
    </div>
  );
}
