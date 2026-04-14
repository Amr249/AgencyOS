import { getServerSession } from "next-auth";
import { getSettings } from "@/actions/settings";
import { getTags } from "@/actions/client-tags";
import { authOptions } from "@/lib/auth";
import { SettingsContent } from "./settings-content";

export const metadata = {
  title: "الإعدادات",
};

export default async function SettingsPage() {
  const [result, tagsResult] = await Promise.all([getSettings(), getTags()]);
  const initial = result.ok ? result.data : null;
  const initialTags = tagsResult.ok ? tagsResult.data : [];
  const adminEmail = process.env.ADMIN_EMAIL ?? "";
  const session = await getServerSession(authOptions);
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">الإعدادات</h2>
        <p className="text-muted-foreground">
          إدارة ملف الوكالة، إعدادات الفواتير، الهوية والحساب.
        </p>
      </div>
      <SettingsContent
        initial={initial}
        adminEmail={adminEmail}
        isAdmin={isAdmin}
        initialClientTags={initialTags}
      />
    </div>
  );
}
