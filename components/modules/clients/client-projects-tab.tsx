"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "@/components/modules/projects/new-project-dialog";
import { PROJECT_STATUS_BADGE_CLASS } from "@/types";
import { formatAmount, formatDate } from "@/lib/utils";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { SarCurrencyIcon } from "@/components/ui/sar-currency-icon";

type ProjectRow = {
  id: string;
  name: string;
  status: string;
  endDate: string | null;
  budget: string | null;
};

type ClientProjectsTabProps = {
  clientId: string;
  clientName: string;
  projects: ProjectRow[];
  taskCounts: Record<string, { total: number; done: number }>;
  clients: { id: string; companyName: string | null }[];
  teamMembers?: { id: string; name: string; role: string | null }[];
  defaultCurrency: string;
};

export function ClientProjectsTab({
  clientId,
  clientName,
  projects,
  taskCounts,
  clients,
  teamMembers = [],
  defaultCurrency,
}: ClientProjectsTabProps) {
  const router = useRouter();
  const PROJECT_STATUS_LABELS_EN: Record<string, string> = {
    lead: "Lead",
    active: "Active",
    on_hold: "On Hold",
    review: "In Review",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  const progress = (id: string) => {
    const t = taskCounts[id];
    if (!t || t.total === 0) return 0;
    return Math.round((t.done / t.total) * 100);
  };

  return (
    <Card className="mt-[25px] mb-[25px]">
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Projects</CardTitle>
        <NewProjectDialog
          trigger={
            <Button variant="secondary" size="sm">
              <PlusCircledIcon className="me-2 h-4 w-4" />
              New Project
            </Button>
          }
          clients={clients}
          teamMembers={teamMembers}
          defaultCurrency={defaultCurrency}
          defaultClientId={clientId}
          onSuccess={() => router.refresh()}
        />
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <p className="text-muted-foreground text-sm">No projects for this client yet.</p>
            <NewProjectDialog
              trigger={
                <Button variant="secondary" size="sm">
                  <PlusCircledIcon className="me-2 h-4 w-4" />
                  Add Project
                </Button>
              }
              clients={clients}
              teamMembers={teamMembers}
              defaultCurrency={defaultCurrency}
              defaultClientId={clientId}
              onSuccess={() => router.refresh()}
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-neutral-100 bg-white">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50">
                <tr>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                    Project
                  </th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                    Deadline
                  </th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                    Budget
                  </th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-neutral-400">
                    Progress
                  </th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr
                    key={p.id}
                    className="group border-b border-neutral-50 transition-colors last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3 text-start">
                      <Link
                        href={`/dashboard/projects/${p.id}`}
                        className="text-sm font-medium text-neutral-900 hover:text-neutral-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-start">
                      <Badge
                        variant="outline"
                        className={PROJECT_STATUS_BADGE_CLASS[p.status] ?? undefined}
                      >
                        {PROJECT_STATUS_LABELS_EN[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-start text-sm text-neutral-500">{formatDate(p.endDate)}</td>
                    <td className="px-4 py-3 text-start text-sm text-neutral-500">
                      <span className="inline-flex items-center gap-1">
                        {formatAmount(p.budget)}
                        <SarCurrencyIcon className="text-neutral-500" />
                      </span>
                    </td>
                    <td className="px-4 py-3 text-start">
                      <div className="min-w-[80px]">
                        <Progress value={progress(p.id)} className="h-2" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
