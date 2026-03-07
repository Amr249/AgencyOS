"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type Member = { id: string; name: string; avatarUrl?: string | null };

type AvatarStackProps = {
  members: Member[];
  max?: number;
  className?: string;
};

export function AvatarStack({ members, max = 3, className = "" }: AvatarStackProps) {
  if (members.length === 0) return null;
  const show = members.slice(0, max);
  const rest = members.length - max;

  return (
    <div className={`flex -space-x-2 flex-row-reverse ${className}`}>
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
