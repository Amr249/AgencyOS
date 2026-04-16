import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sessionUserRole } from "@/lib/auth-helpers";
import { getMemberDashboardData } from "@/actions/member-dashboard";
import { MemberPaymentsPageContent } from "@/components/member-dashboard/member-payments-page-content";

export const metadata: Metadata = {
  title: "المدفوعات",
  description: "سجل المدفوعات",
};

export default async function PaymentsPage() {
  const session = await getServerSession(authOptions);
  if (sessionUserRole(session) !== "member") {
    redirect("/dashboard/invoices");
  }

  const res = await getMemberDashboardData();
  if (!res.ok) {
    return (
      <div className="space-y-2 text-start" dir="rtl" lang="ar">
        <h1 className="text-2xl font-bold tracking-tight">المدفوعات</h1>
        <p className="text-destructive text-sm">
          {res.error === "forbidden" || res.error === "unauthorized"
            ? "ليس لديك صلاحية لهذه الصفحة."
            : "تعذّر تحميل البيانات."}
        </p>
      </div>
    );
  }

  return (
    <MemberPaymentsPageContent
      salaryExpenses={res.data.salaryExpenses}
    />
  );
}
