"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { NewProjectDialog } from "@/components/modules/projects/new-project-dialog";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_CLASS } from "@/types";
import { formatBudgetSAR, formatDate } from "@/lib/utils";
import { PlusCircledIcon } from "@radix-ui/react-icons";

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

  const progress = (id: string) => {
    const t = taskCounts[id];
    if (!t || t.total === 0) return 0;
    return Math.round((t.done / t.total) * 100);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>المشاريع</CardTitle>
        <NewProjectDialog
          trigger={
            <Button variant="secondary" size="sm">
              <PlusCircledIcon className="me-2 h-4 w-4" />
              مشروع جديد
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
            <p className="text-muted-foreground text-sm">لا توجد مشاريع لهذا العميل بعد.</p>
            <NewProjectDialog
              trigger={
                <Button variant="secondary" size="sm">
                  <PlusCircledIcon className="me-2 h-4 w-4" />
                  إضافة مشروع
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
          <div className="overflow-x-auto" dir="rtl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-right text-muted-foreground">
                  <th className="pb-2 ps-4 font-medium">اسم المشروع</th>
                  <th className="pb-2 ps-4 font-medium">الحالة</th>
                  <th className="pb-2 ps-4 font-medium">الموعد النهائي</th>
                  <th className="pb-2 ps-4 font-medium">الميزانية</th>
                  <th className="pb-2 font-medium">شريط التقدم</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-3 ps-4 text-right">
                      <Link
                        href={`/dashboard/projects/${p.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {p.name}
                      </Link>
                    </td>
                    <td className="py-3 ps-4 text-right">
                      <Badge
                        variant="outline"
                        className={PROJECT_STATUS_BADGE_CLASS[p.status] ?? undefined}
                      >
                        {PROJECT_STATUS_LABELS[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="py-3 ps-4 text-right">{formatDate(p.endDate)}</td>
                    <td className="py-3 ps-4 text-right">{formatBudgetSAR(p.budget)}</td>
                    <td className="py-3 text-right">
                      <div className="min-w-[80px]">
                        <Progress value={progress(p.id)} className="h-2" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
