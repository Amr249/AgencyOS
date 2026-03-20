import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Mail, Phone } from "lucide-react";
import { getTeamMemberById, getMemberProjects } from "@/actions/team";
import { getExpensesByTeamMemberId } from "@/actions/expenses";
import { buildGmailComposeUrl, buildWhatsAppChatUrl } from "@/lib/contact-links";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GmailBrandIcon, WhatsAppBrandIcon } from "@/components/modules/team/contact-action-icons";
import { EditTeamMemberButton } from "@/components/modules/team/edit-team-member-button";
import { TeamMemberDetailTabs } from "@/components/modules/team/team-member-detail-tabs";

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
  if (!result.ok) return { title: "Team member | AgencyOS" };
  return {
    title: `${result.data.name} | Team | AgencyOS`,
    description: `Team member profile: ${result.data.name}`,
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
      <div dir="ltr">
        <p className="text-destructive">{memberResult.error}</p>
      </div>
    );
  }

  const member = memberResult.data;
  const projects = projectsResult.ok ? projectsResult.data : [];
  const expenses = expensesResult.ok ? expensesResult.data : [];
  const totalPaid = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const whatsappUrl = member.phone ? buildWhatsAppChatUrl(member.phone) : null;
  const gmailUrl = member.email ? buildGmailComposeUrl(member.email) : null;

  return (
    <div className="space-y-6" dir="ltr">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard/team" className="hover:text-foreground">
          Team
        </Link>
        <ChevronRight className="h-4 w-4 shrink-0" />
        <span className="text-foreground">{member.name}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
        <Card className="flex h-full flex-col text-left">
          <CardContent className="flex flex-1 flex-col items-start justify-start pt-6">
            <div className="flex w-full flex-col items-start gap-4 sm:flex-row sm:flex-wrap sm:items-start">
              <div className="flex min-w-0 items-start gap-4">
                <Avatar className="h-16 w-16 shrink-0">
                  <AvatarImage src={member.avatarUrl ?? undefined} alt={member.name} />
                  <AvatarFallback className="bg-muted text-lg text-muted-foreground">
                    {getInitials(member.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 text-left">
                  <h1 className="text-2xl font-bold tracking-tight">{member.name}</h1>
                  {member.role ? <p className="text-muted-foreground">{member.role}</p> : null}
                  <Badge
                    variant={member.status === "active" ? "default" : "secondary"}
                    className={`mt-2 ${member.status === "active" ? "bg-green-600 hover:bg-green-700" : ""}`}
                  >
                    {member.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </div>
              <div className="shrink-0 sm:pt-1">
                <EditTeamMemberButton member={member} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex h-full flex-col text-left">
          <CardHeader className="items-start space-y-0 pb-3 text-left">
            <CardTitle className="text-lg">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-4 text-left text-sm">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">Email</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {member.email ? (
                      <a href={`mailto:${member.email}`} className="break-all text-primary hover:underline">
                        {member.email}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">Not set — add it via Edit member</p>
                    )}
                    {member.email && gmailUrl ? (
                      <Button
                        asChild
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 shrink-0 text-[#EA4335] hover:bg-red-50 hover:text-[#c5221f] dark:hover:bg-red-950/30"
                      >
                        <a
                          href={gmailUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open in Gmail"
                          aria-label="Open in Gmail"
                        >
                          <GmailBrandIcon className="size-4" />
                          <span className="sr-only">Open in Gmail</span>
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">Phone</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    {member.phone ? (
                      <a href={`tel:${member.phone.replace(/\s/g, "")}`} className="text-primary hover:underline">
                        {member.phone}
                      </a>
                    ) : (
                      <p className="text-muted-foreground">Not set — add it via Edit member</p>
                    )}
                    {member.phone && whatsappUrl ? (
                      <Button
                        asChild
                        size="icon"
                        className="h-8 w-8 shrink-0 bg-[#25D366] text-white hover:bg-[#20bd5a]"
                      >
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Chat on WhatsApp"
                          aria-label="Chat on WhatsApp"
                        >
                          <WhatsAppBrandIcon className="size-4" />
                          <span className="sr-only">Chat on WhatsApp</span>
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <TeamMemberDetailTabs memberId={member.id} projects={projects} expenses={expenses} totalPaid={totalPaid} />
    </div>
  );
}
