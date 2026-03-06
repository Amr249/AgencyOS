"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_CLASS } from "@/types";
import { updatePhaseStatus } from "@/actions/projects";
import { EditProjectDialog } from "./edit-project-dialog";
import { cn, formatBudgetSAR, formatDate } from "@/lib/utils";
import type { phases } from "@/lib/db/schema";
import { ChevronLeft } from "lucide-react";

const PHASE_NAME_AR: Record<string, string> = {
  Discovery: "الاكتشاف",
  Design: "التصميم",
  Development: "التطوير",
  Review: "المراجعة",
  Launch: "الإطلاق",
};

const PHASE_STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  active: "نشط",
  completed: "مكتمل",
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

type ClientOption = { id: string; companyName: string | null };

type ProjectOverviewTabProps = {
  project: ProjectData;
  clients: ClientOption[];
  defaultCurrency: string;
};

export function ProjectOverviewTab({
  project,
  clients,
  defaultCurrency,
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
    <div className="space-y-6" dir="rtl">
      <Card dir="rtl" className="text-right">
        <CardHeader className="flex flex-row items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="order-2">
            تعديل
          </Button>
          <CardTitle className="order-1">التفاصيل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-medium",
                PROJECT_STATUS_BADGE_CLASS[project.status] ?? "bg-muted"
              )}
            >
              {PROJECT_STATUS_LABELS[project.status] ?? project.status}
            </span>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="text-right">
              <p className="text-muted-foreground text-xs">تاريخ البدء</p>
              <p>{formatDate(project.startDate)}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">العميل</p>
              <div className="flex items-center gap-2 justify-end">
                <Link
                  href={`/dashboard/clients/${project.clientId}`}
                  className="font-medium hover:underline"
                >
                  {project.clientName ?? "—"}
                </Link>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={project.clientLogoUrl ?? undefined} />
                  <AvatarFallback className="text-xs">
                    {(project.clientName ?? "?").slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">الميزانية</p>
              <p>{formatBudgetSAR(project.budget)}</p>
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">تاريخ الانتهاء / الموعد النهائي</p>
              <p>{formatDate(project.endDate)}</p>
            </div>
          </div>
          {project.description ? (
            <div className="text-right">
              <p className="text-muted-foreground text-xs">الوصف</p>
              <p className="mt-1 whitespace-pre-wrap text-sm">{project.description}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {phasesState.length > 0 && (
        <Card dir="rtl" className="text-right">
          <CardHeader>
            <CardTitle>المراحل</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-2 flex-row-reverse justify-end">
              {phasesState.map((phase, i) => (
                <React.Fragment key={phase.id}>
                  {i > 0 && (
                    <ChevronLeft className="text-muted-foreground h-4 w-4 shrink-0" />
                  )}
                  <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 flex-row-reverse">
                    <span className="font-medium">{PHASE_NAME_AR[phase.name] ?? phase.name}</span>
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-xs",
                        phase.status === "completed" && "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
                        phase.status === "active" && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
                        phase.status === "pending" && "text-muted-foreground"
                      )}
                    >
                      {PHASE_STATUS_AR[phase.status] ?? phase.status}
                    </span>
                    <div className="flex gap-1 flex-row-reverse">
                      {phase.status !== "active" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => handlePhaseStatus(phase.id, "active")}
                        >
                          تفعيل
                        </Button>
                      )}
                      {phase.status !== "completed" && (
                        <Button
                          variant="default"
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handlePhaseStatus(phase.id, "completed")}
                        >
                          تم
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
