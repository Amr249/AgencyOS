import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRecentActivity } from "@/actions/activity-log";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export const metadata: Metadata = {
  title: "Activity",
  description: "Recent activity across projects",
};

export default async function ActivityPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  if ((session.user as { role?: string }).role === "member") redirect("/dashboard/me");

  const res = await getRecentActivity(100);
  const items = res.ok ? res.data : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Activity</h1>
        <p className="text-muted-foreground text-sm">
          Recent events across the workspace (latest 100).
        </p>
      </div>
      <RecentActivity items={items} showViewAll={false} />
    </div>
  );
}
