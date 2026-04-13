"use client";
import { useState, useTransition, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { assignTask, unassignTask } from "@/actions/assignments";

type Member = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

type Assignee = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
};

interface AssigneePickerProps {
  taskId: string;
  teamMembers: Member[];
  currentAssignees: Assignee[];
  onAssigneesChange?: () => void;
}

export function AssigneePicker({
  taskId,
  teamMembers,
  currentAssignees,
  onAssigneesChange,
}: AssigneePickerProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [localAssignees, setLocalAssignees] = useState<Assignee[]>(currentAssignees);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setLocalAssignees(currentAssignees);
      setError(null);
    });
  }, [taskId, currentAssignees]);

  const isAssigned = (userId: string) => localAssignees.some((a) => a.userId === userId);

  function getInitials(name: string) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2);
  }

  function handleToggle(member: Member) {
    const assigned = isAssigned(member.id);
    setError(null);
    startTransition(async () => {
      if (assigned) {
        const result = await unassignTask(taskId, member.id);
        if (result.success) {
          setLocalAssignees((prev) => prev.filter((a) => a.userId !== member.id));
          onAssigneesChange?.();
        } else {
          setError(result.error ?? null);
        }
      } else {
        const result = await assignTask(taskId, member.id);
        if (result.success) {
          setLocalAssignees((prev) => [
            ...prev,
            {
              userId: member.id,
              name: member.name,
              email: member.email,
              avatarUrl: member.avatarUrl,
            },
          ]);
          onAssigneesChange?.();
        } else {
          setError(result.error ?? null);
        }
      }
    });
  }

  return (
    <div className="space-y-2" dir="ltr" lang="en">
      <p className="text-sm font-medium">Assignees</p>

      <div className="flex min-h-[32px] flex-wrap items-center gap-2">
        {localAssignees.length === 0 ? (
          <span className="text-muted-foreground text-sm">No one assigned yet</span>
        ) : (
          localAssignees.map((a) => (
            <div
              key={a.userId}
              className="flex items-center gap-1.5 rounded-full bg-secondary py-1 ps-1 pe-3"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={a.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[10px]">{getInitials(a.name)}</AvatarFallback>
              </Avatar>
              <span className="text-xs">{a.name}</span>
              <button
                type="button"
                onClick={() =>
                  handleToggle({ id: a.userId, name: a.name, email: a.email, avatarUrl: a.avatarUrl })
                }
                className="text-muted-foreground me-1 text-xs transition-colors hover:text-destructive"
                disabled={isPending}
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* modal={false}: required when this popover is inside a Dialog so content is not clipped / focus-trapped */}
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs" disabled={isPending}>
            {isPending ? "Saving…" : "+ Assign member"}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="z-200 w-72 p-2 text-start"
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          dir="ltr"
          lang="en"
        >
          <p className="text-muted-foreground mb-2 border-b border-border px-2 pb-2 text-xs">
            Choose a team member
          </p>
          {teamMembers.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">
              No team members available. Add people under Team, or ensure login users match team emails.
            </p>
          ) : (
            <div className="max-h-56 min-h-10 space-y-1 overflow-y-auto">
              {teamMembers.map((member) => {
                const assigned = isAssigned(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => handleToggle(member)}
                    disabled={isPending}
                    className={`flex w-full min-h-11 items-center gap-3 rounded-md px-2 py-2 text-start transition-colors ${
                      assigned
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
                      <AvatarFallback className="text-xs">{getInitials(member.name || "?")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{member.name || "—"}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {member.email?.trim() ? member.email : "No email"}
                      </p>
                    </div>
                    {assigned ? <span className="shrink-0 text-xs text-primary">✓</span> : null}
                  </button>
                );
              })}
            </div>
          )}
        </PopoverContent>
      </Popover>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
