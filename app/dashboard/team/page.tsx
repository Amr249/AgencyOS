import type { Metadata } from "next";
import { getTeamMembers } from "@/actions/team";
import { TeamListView } from "@/components/modules/team/team-list-view";

export const metadata: Metadata = {
  title: "الفريق",
  description: "إدارة أعضاء الفريق والتعيينات",
};

export default async function TeamPage() {
  const result = await getTeamMembers();

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">الفريق</h1>
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  return <TeamListView members={result.data} />;
}
