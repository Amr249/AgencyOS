"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PROJECT_STATUS_LABELS_EN,
  PROJECT_STATUS_PILL_CLASS,
} from "@/types";
import { updatePhaseStatus } from "@/actions/projects";
import { EditProjectDialog } from "./edit-project-dialog";
import { cn, formatDate } from "@/lib/utils";
import { SarMoney } from "@/components/ui/sar-money";
import type { phases } from "@/lib/db/schema";
import { ChevronRight } from "lucide-react";
import { ProjectTimeSummary } from "./project-time-summary";
import { ProjectBudgetWidget } from "./project-budget-widget";
import type { ProjectBudgetSummaryData } from "@/actions/projects";
import {
  ProjectActivityFeed,
  type ActivityFeedEntry,
} from "./project-activity-feed";

const PHASE_STATUS_EN: Record<string, string> = {
  pending: "Pending",
  active: "Active",
  completed: "Completed",
};

type PhaseRow = typeof phases.$inferSelect;

type ProjectData = {
  id: string;
  name: string;
  clientId: string;
  status: string;
  coverImageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  budget: string | null;
  description: string | null;
  clientName: string | null;
  clientLogoUrl: string | null;
  phases: PhaseRow[];
};

type ClientOption = { id: string; companyName: string | null; logoUrl?: string | null };

type ProjectOverviewTabProps = {
  project: ProjectData;
  clients: ClientOption[];
  defaultCurrency: string;
  timeSummary: {
    totalHours: number;
    billableHours: number;
    entryCount: number;
    byMember: {
      teamMemberId: string | null;
      teamMemberName: string;
      totalHours: number;
    }[];
  } | null;
  teamMembers: { id: string; name: string; avatarUrl: string | null }[];
  activityOverviewEntries: ActivityFeedEntry[];
  activityOverviewHasMore: boolean;
  budgetSummary: ProjectBudgetSummaryData | null;
};

export function ProjectOverviewTab({
  project,
  clients,
  defaultCurrency,
  timeSummary,
  teamMembers,
  activityOverviewEntries,
  activityOverviewHasMore,
  budgetSummary,
}: ProjectOverviewTabProps) {
  const [editOpen, setEditOpen] = React.useState(false);
  const [phasesState, setPhasesState] = React.useState(project.phases);
  const router = useRouter();

  const handlePhaseStatus = async (phaseId: string, status: "pending" | "active" | "completed") => {
    const result = await updatePhaseStatus(phaseId, status);
    if (result.ok) {
      setPhasesState((prev) =>
        prev.map((p) => (p.id === phaseId ? { ...p, status } : p))
      );
      router.refresh();
    }
  };

  return (
    <div className="space-y-6" dir="ltr" lang="en">
      <Card className="text-left">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Details</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-medium",
                PROJECT_STATUS_PILL_CLASS[project.status] ?? "bg-neutral-100 text-neutral-600"
              )}
            >
              {PROJECT_STATUS_LABELS_EN[project.status] ?? project.status}
            </span>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Start Date</p>
              <p>{formatDate(project.startDate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Client</p>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={project.clientLogoUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {(project.clientName ?? "?").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
                <Link
                  href={`/dashboard/clients/${project.clientId}`}
                  className="font-medium hover:underline"
                >
                  {project.clientName ?? "—"}
                </Link>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Budget</p>
              <p>
                <SarMoney value={project.budget} iconClassName="h-3.5 w-3.5" />
              </p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Deadline</p>
              <p>{formatDate(project.endDate)}</p>
            </div>
          </div>
          {project.description ? (
            <div>
              <p className="text-muted-foreground text-xs">Description</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{project.description}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {budgetSummary ? <ProjectBudgetWidget summary={budgetSummary} /> : null}

      {phasesState.length > 0 && (
        <Card className="text-left">
          <CardHeader>
            <CardTitle>Phases</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2">
              {phasesState.map((phase, i) => (
                <React.Fragment key={phase.id}>
                  {i > 0 && (
                    <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                  )}
                  <div className="flex flex-col gap-2 rounded-lg border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:gap-2">
                    <span className="font-medium">{phase.name}</span>
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-xs w-fit",
                        phase.status === "completed" && "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
                        phase.status === "active" && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
                        phase.status === "pending" && "text-muted-foreground"
                      )}
                    >
                      {PHASE_STATUS_EN[phase.status] ?? phase.status}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {phase.status !== "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handlePhaseStatus(phase.id, "active")}
                        >
                          Activate
                        </Button>
                      )}
                      {phase.status !== "completed" && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 bg-green-600 text-xs text-white hover:bg-green-700"
                          onClick={() => handlePhaseStatus(phase.id, "completed")}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ProjectTimeSummary summary={timeSummary} teamMembers={teamMembers} />

      <ProjectActivityFeed
        projectId={project.id}
        variant="compact"
        entries={activityOverviewEntries}
        trailingHasMore={activityOverviewHasMore}
      />

      <EditProjectDialog
        project={{
          id: project.id,
          name: project.name,
          clientId: project.clientId,
          status: project.status,
          coverImageUrl: project.coverImageUrl ?? null,
          startDate: project.startDate,
          endDate: project.endDate,
          budget: project.budget,
          description: project.description,
        }}
        clients={clients}
        defaultCurrency={defaultCurrency}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
