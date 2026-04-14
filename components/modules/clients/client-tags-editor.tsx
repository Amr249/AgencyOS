"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setClientTags } from "@/actions/client-tags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { clientTagBadgeClass } from "@/lib/client-metadata";
import { useTranslateActionError } from "@/hooks/use-translate-action-error";
import { isDbErrorKey } from "@/lib/i18n-errors";

export type ClientTagOption = { id: string; name: string; color: string };

type ClientTagsEditorProps = {
  clientId: string;
  assignedTags: ClientTagOption[];
  allTags: ClientTagOption[];
  isRtl?: boolean;
};

export function ClientTagsEditor({
  clientId,
  assignedTags,
  allTags,
  isRtl = false,
}: ClientTagsEditorProps) {
  const router = useRouter();
  const translateErr = useTranslateActionError();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const assignedKey = assignedTags.map((t) => t.id).sort().join(",");
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(assignedTags.map((t) => t.id))
  );

  React.useEffect(() => {
    setSelected(new Set(assignedTags.map((t) => t.id)));
  }, [assignedKey]);

  async function applyNext(next: Set<string>) {
    setPending(true);
    try {
      const res = await setClientTags(clientId, [...next]);
      if (!res.ok) {
        const msg = typeof res.error === "string" ? res.error : "Failed to update tags";
        toast.error(isDbErrorKey(msg) ? translateErr(msg) : msg);
        router.refresh();
        return;
      }
      setSelected(next);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function toggle(tagId: string) {
    const next = new Set(selected);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    void applyNext(next);
  }

  return (
    <div
      className={`flex flex-col gap-2 ${isRtl ? "items-end" : "items-start"}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <p className="text-muted-foreground text-xs font-medium">Tags</p>
      <div className={`flex flex-wrap items-center gap-1.5 ${isRtl ? "justify-end" : "justify-start"}`}>
        {assignedTags.length === 0 ? (
          <span className="text-muted-foreground text-sm">No tags</span>
        ) : (
          assignedTags.map((t) => (
            <Badge
              key={t.id}
              variant="secondary"
              className={`font-normal ${clientTagBadgeClass(t.color)}`}
            >
              {t.name}
            </Badge>
          ))
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-7 text-xs" disabled={pending}>
              Manage tags
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align={isRtl ? "end" : "start"}>
            <p className="text-muted-foreground mb-2 text-xs">Add or remove tags</p>
            {allTags.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No tags yet. Create tags in Settings.
              </p>
            ) : (
              <ul className="max-h-56 space-y-2 overflow-y-auto pe-1">
                {allTags.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={selected.has(t.id)}
                        disabled={pending}
                        onCheckedChange={() => toggle(t.id)}
                      />
                      <Badge
                        variant="secondary"
                        className={`font-normal ${clientTagBadgeClass(t.color)}`}
                      >
                        {t.name}
                      </Badge>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
