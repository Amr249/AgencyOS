'use client';
import { useState, useTransition, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { assignTask, unassignTask } from '@/actions/assignments';

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
    setLocalAssignees(currentAssignees);
    setError(null);
  }, [taskId, currentAssignees]);

  const isAssigned = (userId: string) =>
    localAssignees.some((a) => a.userId === userId);

  function getInitials(name: string) {
    return name.split(' ').map((n) => n[0]).join('').slice(0, 2);
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
    <div className="space-y-2" dir="rtl">
      <p className="text-sm font-medium">المُعيَّنون</p>

      {/* Current assignees row */}
      <div className="flex items-center gap-2 flex-wrap min-h-[32px]">
        {localAssignees.length === 0 ? (
          <span className="text-sm text-muted-foreground">لم يتم التعيين بعد</span>
        ) : (
          localAssignees.map((a) => (
            <div key={a.userId} className="flex items-center gap-1.5 bg-secondary rounded-full pl-3 pr-1 py-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={a.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[10px]">{getInitials(a.name)}</AvatarFallback>
              </Avatar>
              <span className="text-xs">{a.name}</span>
              <button
                onClick={() => handleToggle({ id: a.userId, name: a.name, email: a.email, avatarUrl: a.avatarUrl })}
                className="text-muted-foreground hover:text-destructive transition-colors text-xs mr-1"
                disabled={isPending}
                title="إزالة"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* Picker popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs h-8" disabled={isPending}>
            {isPending ? 'جاري الحفظ...' : '+ تعيين عضو'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start" dir="rtl">
          <p className="text-xs text-muted-foreground px-2 pb-2 border-b border-border mb-2">
            اختر عضواً من الفريق
          </p>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {teamMembers.map((member) => {
              const assigned = isAssigned(member.id);
              return (
                <button
                  key={member.id}
                  onClick={() => handleToggle(member)}
                  disabled={isPending}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-right transition-colors
                    ${assigned
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-secondary text-foreground'
                    }`}
                >
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarImage src={member.avatarUrl ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                  {assigned && (
                    <span className="text-xs text-primary shrink-0">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Error */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
