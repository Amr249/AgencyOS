"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pause, Play } from "lucide-react";
import { toast } from "sonner";

import { getRunningTimer, startTimer, stopTimer } from "@/actions/time-tracking";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DbErrorKey } from "@/lib/db-errors";

function formatHhMmSs(totalMs: number): string {
  const sec = Math.max(0, Math.floor(totalMs / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatActionError(error: unknown): string {
  if (typeof error === "string") {
    const keys: DbErrorKey[] = ["connectionTimeout", "fetchFailed", "unknown"];
    if (keys.includes(error as DbErrorKey)) {
      if (error === "connectionTimeout") return "Database connection timed out. Try again.";
      if (error === "fetchFailed") return "Network error. Try again.";
      return "Something went wrong.";
    }
    return error;
  }
  return "Something went wrong.";
}

type RunningEntry = NonNullable<
  Extract<Awaited<ReturnType<typeof getRunningTimer>>, { ok: true }>["data"]
>;

export type TimerWidgetProps = {
  taskId: string;
  teamMemberId?: string;
  /** Called after a running timer is stopped successfully for this task. */
  onTimeLogged?: () => void;
};

export function TimerWidget({ taskId, teamMemberId, onTimeLogged }: TimerWidgetProps) {
  const [runningEntry, setRunningEntry] = useState<RunningEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [pending, setPending] = useState(false);

  const refreshRunning = useCallback(async () => {
    const res = await getRunningTimer(teamMemberId);
    if (!res.ok) {
      toast.error(formatActionError(res.error));
      setRunningEntry(null);
      return;
    }
    setRunningEntry(res.data);
  }, [teamMemberId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await refreshRunning();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshRunning, taskId]);

  const isThisTask = runningEntry != null && runningEntry.taskId === taskId;
  const otherTaskRunning = runningEntry != null && runningEntry.taskId !== taskId;

  useEffect(() => {
    if (!isThisTask || !runningEntry?.startedAt) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [isThisTask, runningEntry?.id, runningEntry?.startedAt]);

  const displayTime = useMemo(() => {
    if (!isThisTask || !runningEntry?.startedAt) return "00:00:00";
    void tick;
    const ms = Date.now() - new Date(runningEntry.startedAt).getTime();
    return formatHhMmSs(ms);
  }, [isThisTask, runningEntry?.startedAt, tick]);

  async function handleStart() {
    setPending(true);
    try {
      const res = await startTimer({ taskId, teamMemberId });
      if (!res.ok) {
        if (typeof res.error === "string") {
          toast.error(res.error);
        } else {
          toast.error("Could not start timer. Check your input.");
        }
        return;
      }
      await refreshRunning();
    } finally {
      setPending(false);
    }
  }

  async function handleStop() {
    if (!runningEntry || runningEntry.taskId !== taskId) return;
    setPending(true);
    try {
      const res = await stopTimer({ timeLogId: runningEntry.id });
      if (!res.ok) {
        if (typeof res.error === "string") {
          toast.error(res.error);
        } else {
          toast.error("Could not stop timer.");
        }
        return;
      }
      setRunningEntry(null);
      onTimeLogged?.();
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return (
      <div dir="ltr" lang="en" className="text-muted-foreground text-sm">
        Loading timer…
      </div>
    );
  }

  return (
    <div dir="ltr" lang="en" className="flex flex-col gap-2">
      {otherTaskRunning ? (
        <Alert variant="destructive">
          <AlertTitle>Another timer is running</AlertTitle>
          <AlertDescription>
            Stop the timer on &quot;{runningEntry.task?.title ?? "another task"}&quot; before starting
            one here.
          </AlertDescription>
        </Alert>
      ) : null}

      <div
        className={cn(
          "flex items-center gap-3 rounded-md border px-3 py-2",
          isThisTask && "border-green-600/45 bg-green-500/[0.07] dark:border-green-500/40 dark:bg-green-500/10"
        )}
      >
        <span
          className={cn(
            "min-w-25 font-mono text-sm tabular-nums tracking-tight",
            isThisTask ? "font-medium text-green-700 dark:text-green-400" : "text-muted-foreground"
          )}
          aria-live="polite"
        >
          {displayTime}
        </span>

        {isThisTask ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-green-600/50 text-green-800 hover:bg-green-500/10 dark:border-green-500/45 dark:text-green-400 dark:hover:bg-green-500/15"
            disabled={pending}
            onClick={() => void handleStop()}
            aria-label="Stop timer"
          >
            <Pause className="size-4 shrink-0" aria-hidden />
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending || otherTaskRunning}
            onClick={() => void handleStart()}
            aria-label="Start timer"
          >
            <Play className="size-4 shrink-0" aria-hidden />
            Start
          </Button>
        )}
      </div>
    </div>
  );
}
