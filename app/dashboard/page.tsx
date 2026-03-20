import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDashboardData } from "@/actions/dashboard";
import { DashboardHome } from "@/components/dashboard-home";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "OnePixle Agency Operations Dashboard",
};

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  // Members go to their own view
  if ((session.user as { role?: string }).role === "member") redirect("/dashboard/my-tasks");

  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          Overview of revenue, projects, tasks, and invoices.
        </p>
      </div>
      <DashboardHome data={data} />
    </div>
  );
}
