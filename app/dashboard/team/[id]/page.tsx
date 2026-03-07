import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getTeamMemberById, getMemberProjects } from "@/actions/team";
import { getExpensesByTeamMemberId } from "@/actions/expenses";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_BADGE_CLASS } from "@/types";
import { EditTeamMemberButton } from "@/components/modules/team/edit-team-member-button";

type Props = { params: Promise<{ id: string }> };

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const result = await getTeamMemberById(id);
  if (!result.ok) return { title: "عضو الفريق | AgencyOS" };
  return {
    title: `${result.data.name} | الفريق | AgencyOS`,
    description: `ملف عضو الفريق: ${result.data.name}`,
  };
}

export default async function TeamMemberDetailPage({ params }: Props) {
  const { id } = await params;
  const [memberResult, projectsResult, expensesResult] = await Promise.all([
    getTeamMemberById(id),
    getMemberProjects(id),
    getExpensesByTeamMemberId(id),
  ]);

  if (!memberResult.ok) {
    if (memberResult.error === "Team member not found" || memberResult.error === "Invalid id") {
      notFound();
    }
    return (
      <div>
        <p className="text-destructive">{memberResult.error}</p>
      </div>
    );
  }

  const member = memberResult.data;
  const projects = projectsResult.ok ? projectsResult.data : [];
  const expenses = expensesResult.ok ? expensesResult.data : [];
  const totalPaid = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/team" className="hover:text-foreground">
          الفريق
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">{member.name}</span>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                <AvatarFallback className="bg-muted text-muted-foreground text-lg">
                  {getInitials(member.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{member.name}</h1>
                {member.role && (
                  <p className="text-muted-foreground">{member.role}</p>
                )}
                <Badge
                  variant={member.status === "active" ? "default" : "secondary"}
                  className={`mt-2 ${member.status === "active" ? "bg-green-600 hover:bg-green-700" : ""}`}
                >
                  {member.status === "active" ? "نشط" : "غير نشط"}
                </Badge>
              </div>
            </div>
            <EditTeamMemberButton member={member} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="projects">المشاريع المعيّنة</TabsTrigger>
          <TabsTrigger value="salary">سجل الرواتب</TabsTrigger>
        </TabsList>
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {projects.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد مشاريع معيّنة لهذا العضو.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المشروع</TableHead>
                      <TableHead className="text-right">العميل</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الدور في المشروع</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-right font-medium">
                          <Link href={`/dashboard/projects/${p.projectId}`} className="hover:underline">
                            {p.projectName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right">{p.clientName ?? "—"}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={PROJECT_STATUS_BADGE_CLASS[p.projectStatus] ?? undefined}>
                            {PROJECT_STATUS_LABELS[p.projectStatus] ?? p.projectStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{p.roleOnProject ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="salary" className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              {expenses.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">لا توجد مدفوعات مرتبطة بهذا العضو.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">التاريخ</TableHead>
                        <TableHead className="text-right">المبلغ</TableHead>
                        <TableHead className="text-right">ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-right">{e.date}</TableCell>
                          <TableCell className="text-right font-medium">{e.amount}</TableCell>
                          <TableCell className="text-right">{e.notes ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 border-t pt-4 text-left">
                    <p className="font-semibold">
                      إجمالي المدفوع لهذا العضو:{" "}
                      <span className="text-primary">{totalPaid.toFixed(2)}</span>
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
