import { endOfMonth, format, isValid, parse } from "date-fns";
import { getTeamMembers } from "@/actions/team-members";
import { getAvailability } from "@/actions/team-availability";
import { TeamAvailabilityCalendar } from "@/components/modules/workspace/team-availability-calendar";
import { WorkspaceNav } from "@/components/modules/workspace/workspace-nav";

type PageProps = { searchParams: Promise<{ month?: string }> };

export default async function WorkspaceAvailabilityPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const raw = sp.month ?? format(new Date(), "yyyy-MM");
  const monthKey = /^\d{4}-\d{2}$/.test(raw) ? raw : format(new Date(), "yyyy-MM");
  const monthDate = parse(`${monthKey}-01`, "yyyy-MM-dd", new Date());
  const anchor = isValid(monthDate) ? monthDate : new Date();
  const dateFrom = format(anchor, "yyyy-MM-dd");
  const dateTo = format(endOfMonth(anchor), "yyyy-MM-dd");

  const [membersRes, availRes] = await Promise.all([
    getTeamMembers(),
    getAvailability({ dateFrom, dateTo }),
  ]);

  const members = membersRes.ok ? membersRes.data.map((m) => ({ id: m.id, name: m.name })) : [];
  const entries = availRes.ok ? availRes.data : [];

  return (
    <div dir="ltr" lang="en" className="h-full space-y-4">
      <WorkspaceNav />
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Team availability</h1>
        <p className="text-muted-foreground text-sm">
          Mark holidays, vacation, sick days, or half days. Weekday entries reduce capacity on the workload view.
        </p>
      </div>
      {!members.length ? (
        <p className="text-muted-foreground text-sm">Add active team members first.</p>
      ) : (
        <TeamAvailabilityCalendar monthKey={monthKey} entries={entries} members={members} />
      )}
    </div>
  );
}
