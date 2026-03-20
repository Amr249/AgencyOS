'use client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Assignee = {
  userId: string;
  name: string;
  avatarUrl: string | null;
};

interface AssigneeAvatarsProps {
  assignees: Assignee[];
  max?: number;
}

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2);
}

export function AssigneeAvatars({ assignees, max = 3 }: AssigneeAvatarsProps) {
  if (assignees.length === 0) return null;

  const visible = assignees.slice(0, max);
  const overflow = assignees.length - max;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center" dir="rtl">
        {visible.map((a, i) => (
          <Tooltip key={a.userId}>
            <TooltipTrigger asChild>
              <Avatar
                className="h-6 w-6 border-2 border-background cursor-default"
                style={{ marginLeft: i > 0 ? '-6px' : 0 }}
              >
                <AvatarImage src={a.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(a.name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{a.name}</p>
            </TooltipContent>
          </Tooltip>
        ))}
        {overflow > 0 && (
          <div
            className="h-6 w-6 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-[10px] text-muted-foreground"
            style={{ marginLeft: '-6px' }}
          >
            +{overflow}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
