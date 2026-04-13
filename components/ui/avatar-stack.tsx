"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Member = { id: string; name: string; avatarUrl?: string | null };

type AvatarStackProps = {
  members: Member[];
  max?: number;
  className?: string;
  /** Stack direction; default `rtl` matches Arabic-first layouts. */
  direction?: "ltr" | "rtl";
};

export function AvatarStack({
  members,
  max = 3,
  className = "",
  direction = "rtl",
}: AvatarStackProps) {
  if (members.length === 0) return null;
  const show = members.slice(0, max);
  const rest = members.length - max;

  return (
    <div
      className={cn(
        "flex -space-x-2",
        direction === "rtl" ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      {show.map((m) => (
        <Avatar
          key={m.id}
          className="h-6 w-6 border-2 border-background shrink-0"
          title={m.name}
        >
          <AvatarImage src={m.avatarUrl ?? undefined} />
          <AvatarFallback className="text-[10px]">
            {(m.name ?? "?").slice(0, 1)}
          </AvatarFallback>
        </Avatar>
      ))}
      {rest > 0 && (
        <div
          className="h-6 w-6 rounded-full bg-muted text-xs flex items-center justify-center border-2 border-background shrink-0"
          title={`+${rest}`}
        >
          +{rest}
        </div>
      )}
    </div>
  );
}
