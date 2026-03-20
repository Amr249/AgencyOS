import type { Metadata } from "next";
import { getTeamMembers } from "@/actions/team";
import { getProjects } from "@/actions/projects";
import { TeamListView } from "@/components/modules/team/team-list-view";

export const metadata: Metadata = {
  title: "Team",
  description: "Manage team members and assignments",
};

export default async function TeamPage() {
  const [result, projectsResult] = await Promise.all([getTeamMembers(), getProjects()]);

  if (!result.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-destructive">{result.error}</p>
      </div>
    );
  }

  const projects = projectsResult.ok
    ? projectsResult.data.map((p) => ({ id: p.id, name: p.name }))
    : [];

  return <TeamListView members={result.data} projects={projects} />;
}
