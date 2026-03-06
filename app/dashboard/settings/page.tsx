import { getSettings } from "@/actions/settings";
import { SettingsContent } from "./settings-content";

export const metadata = {
  title: "الإعدادات",
};

export default async function SettingsPage() {
  const result = await getSettings();
  const initial = result.ok ? result.data : null;
  const adminEmail = process.env.ADMIN_EMAIL ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">الإعدادات</h2>
        <p className="text-muted-foreground">
          إدارة ملف الوكالة، إعدادات الفواتير، الهوية والحساب.
        </p>
      </div>
      <SettingsContent initial={initial} adminEmail={adminEmail} />
    </div>
  );
}
