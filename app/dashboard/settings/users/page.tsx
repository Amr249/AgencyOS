import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AgencyUsersManage } from "@/components/settings/agency-users-manage";
import { authOptions } from "@/lib/auth";

export const metadata = {
  title: "Users",
};

export default async function SettingsUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/settings/users");
  }
  if (session.user.role !== "admin") {
    redirect("/dashboard/me");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground text-sm">
          Manage who can sign in to the dashboard, their roles, and passwords.
        </p>
      </div>
      <AgencyUsersManage currentUserId={session.user.id} showBackLink />
    </div>
  );
}
