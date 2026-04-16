import { getServerSession } from "next-auth";
import { getTags } from "@/actions/client-tags";
import { authOptions } from "@/lib/auth";
import { SettingsContent } from "./settings-content";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const tagsResult = await getTags();
  const initialTags = tagsResult.ok ? tagsResult.data : [];
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="space-y-6" dir="ltr" lang="en">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage appearance, client tags, team logins, and your account.
        </p>
      </div>
      <SettingsContent
        adminEmail={adminEmail}
        isAdmin={isAdmin}
        currentUserId={session?.user?.id ?? ""}
        initialClientTags={initialTags}
      />
    </div>
  );
}
