"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount, generateAvatarFallback } from "@/lib/utils";

type TeamMemberLite = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type ProjectTimeSummaryData = {
  totalHours: number;
  billableHours: number;
  entryCount: number;
  byMember: {
    teamMemberId: string | null;
    teamMemberName: string;
    totalHours: number;
  }[];
};

type ProjectTimeSummaryProps = {
  summary: ProjectTimeSummaryData | null;
  teamMembers: TeamMemberLite[];
};

export function ProjectTimeSummary({ summary, teamMembers }: ProjectTimeSummaryProps) {
  const hasData = Boolean(summary && summary.entryCount > 0);
  const avatarById = new Map(teamMembers.map((m) => [m.id, m.avatarUrl]));

  return (
    <Card className="text-left" dir="ltr" lang="en">
      <CardHeader>
        <CardTitle>Time Tracking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasData ? (
          <p className="text-muted-foreground text-sm">No time logged yet.</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-muted-foreground text-xs">Total Hours</p>
                <p className="font-semibold tabular-nums">{formatAmount(String(summary!.totalHours))}h</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Billable Hours</p>
                <p className="font-semibold tabular-nums">{formatAmount(String(summary!.billableHours))}h</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Entries</p>
                <p className="font-semibold tabular-nums">{summary!.entryCount}</p>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs">Team Breakdown</p>
              {summary!.byMember.length === 0 ? (
                <p className="text-muted-foreground text-sm">No team-member breakdown yet.</p>
              ) : (
                <ul className="space-y-2">
                  {summary!.byMember.map((row) => {
                    const avatarUrl = row.teamMemberId ? avatarById.get(row.teamMemberId) ?? null : null;
                    return (
                      <li
                        key={`${row.teamMemberId ?? "unassigned"}-${row.teamMemberName}`}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={avatarUrl ?? undefined} alt={row.teamMemberName} />
                            <AvatarFallback className="text-xs">
                              {generateAvatarFallback(row.teamMemberName).slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate text-sm font-medium">{row.teamMemberName}</span>
                        </div>
                        <span className="text-muted-foreground tabular-nums text-sm">
                          {formatAmount(String(row.totalHours))}h
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
