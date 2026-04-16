import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getMyAccount } from "@/actions/account";
import { AccountSettingsForm } from "@/components/account/account-settings-form";

export const metadata = {
  title: "إعدادات الحساب",
};

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/dashboard/account");
  }

  const role = sessionUserRole(session);
  const res = await getMyAccount();
  if (!res.ok) {
    return (
      <div className="mx-auto max-w-3xl" dir="rtl" lang="ar">
        <p className="text-muted-foreground text-sm">تعذّر تحميل معلومات الحساب.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl" dir="rtl" lang="ar">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">إعدادات الحساب</h1>
        <p className="text-muted-foreground text-sm">
          تحكّم في بياناتك الشخصية، كلمة المرور، الصورة الشخصية، ومظهر النظام.
        </p>
      </div>
      <AccountSettingsForm
        initialAccount={res.data}
        isMember={role === "member"}
      />
    </div>
  );
}
