"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useLocale } from "next-intl";
import { X } from "lucide-react";
import { toast } from "sonner";

import { markWelcomeSeen } from "@/actions/welcome";

/** Dedupe React Strict Mode double-mount (ref resets); persistence remains DB-only. */
const welcomeToastHandledUserIds = new Set<string>();

/**
 * Renders nothing; fires a one-time welcome toast for agency users who have not seen it (DB-backed).
 * Only mount under the main dashboard shell — not on onboarding routes.
 */
export function WelcomeToast() {
  const { data: session, status, update } = useSession();
  const locale = useLocale();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    if (session.user.role === "client_portal") return;
    if (session.user.hasSeenWelcome !== false) return;
    const userId = session.user.id;
    if (welcomeToastHandledUserIds.has(userId)) return;
    welcomeToastHandledUserIds.add(userId);

    const isAr = locale === "ar";
    const title = isAr ? "أهلاً بك في AgencyOS! 👋" : "Welcome to AgencyOS! 👋";
    const message = isAr
      ? "بنينا هذا النظام لأننا عشنا المشكلة بأنفسنا — مشاريع بدون تنظيم، فواتير ضائعة، وملفات مبعثرة في كل مكان. بدأ كأداة داخلية لوكالتنا، والآن نشاركه مع كل وكالة ومستقل يستحق أن يدير عمله باحترافية. نتمنى لك تجربة مميزة!"
      : "We built this because we lived the problem ourselves — projects with no structure, lost invoices, and files scattered everywhere. It started as an internal tool for our agency, and now we're sharing it with every agency and freelancer who deserves to run their business professionally. We hope you enjoy it!";

    toast.custom(
      (t) => (
        <div
          dir={isAr ? "rtl" : "ltr"}
          className="pointer-events-auto w-[min(100vw-2rem,26rem)] rounded-xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-orange-50/95 to-rose-50/85 p-4 text-stone-900 shadow-lg ring-1 ring-black/5 dark:border-amber-900/35 dark:from-stone-900 dark:via-stone-900 dark:to-stone-950 dark:text-stone-100 dark:ring-white/10"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-base font-semibold leading-snug">{title}</p>
              <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">{message}</p>
            </div>
            <button
              type="button"
              onClick={() => toast.dismiss(t)}
              className="shrink-0 rounded-md p-1 text-stone-500 transition-colors hover:bg-black/5 hover:text-stone-900 dark:hover:bg-white/10 dark:hover:text-stone-100"
              aria-label={isAr ? "إغلاق" : "Dismiss"}
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      ),
      { duration: 15_000, position: "top-center" }
    );

    void (async () => {
      const res = await markWelcomeSeen();
      if (res.ok) {
        await update({ user: { hasSeenWelcome: true } });
      } else {
        welcomeToastHandledUserIds.delete(userId);
      }
    })();
  }, [session, status, locale, update]);

  return null;
}
