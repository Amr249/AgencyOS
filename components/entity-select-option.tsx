"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type ProjectPickerOption = {
  id: string;
  name: string;
  coverImageUrl?: string | null;
  clientLogoUrl?: string | null;
};

export function entityInitials(name: string | null | undefined, maxChars = 2): string {
  const t = (name ?? "?").trim();
  if (!t) return "?";
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0]!.slice(0, maxChars).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase().slice(0, maxChars);
}

export function projectDisplayImageSrc(
  coverImageUrl: string | null | undefined,
  clientLogoUrl: string | null | undefined
): string | undefined {
  const c = coverImageUrl?.trim();
  if (c) return c;
  const l = clientLogoUrl?.trim();
  if (l) return l;
  return undefined;
}

export function ProjectSelectThumb({
  coverImageUrl,
  clientLogoUrl,
  fallbackName,
  className = "h-5 w-5",
}: {
  coverImageUrl?: string | null;
  clientLogoUrl?: string | null;
  fallbackName: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("shrink-0", className)}>
      <AvatarImage src={projectDisplayImageSrc(coverImageUrl, clientLogoUrl)} alt="" />
      <AvatarFallback className="text-[10px]">{entityInitials(fallbackName, 1)}</AvatarFallback>
    </Avatar>
  );
}

export function ClientSelectOptionRow({
  logoUrl,
  label,
  className,
}: {
  logoUrl?: string | null;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Avatar className="h-5 w-5 shrink-0">
        <AvatarImage src={logoUrl?.trim() || undefined} alt="" />
        <AvatarFallback className="text-[10px]">{entityInitials(label, 1)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{label}</span>
    </div>
  );
}

export function ProjectSelectOptionRow({
  coverImageUrl,
  clientLogoUrl,
  name,
  className,
}: {
  coverImageUrl?: string | null;
  clientLogoUrl?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <ProjectSelectThumb
        coverImageUrl={coverImageUrl}
        clientLogoUrl={clientLogoUrl}
        fallbackName={name}
      />
      <span className="truncate">{name}</span>
    </div>
  );
}

export function TeamMemberSelectOptionRow({
  avatarUrl,
  name,
  secondary,
  className,
}: {
  avatarUrl?: string | null;
  name: string;
  secondary?: string | null;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-2", className)}>
      <Avatar className="h-5 w-5 shrink-0">
        <AvatarImage src={avatarUrl?.trim() || undefined} alt="" />
        <AvatarFallback className="text-[10px]">{entityInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 truncate">
        <span className="font-medium">{name}</span>
        {secondary != null && secondary !== "" ? (
          <span className="text-muted-foreground ms-1 text-xs">— {secondary}</span>
        ) : null}
      </span>
    </div>
  );
}
