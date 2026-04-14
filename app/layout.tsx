import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import Providers from "@/components/providers";
import { cn } from "@/lib/utils";

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
});

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
});

/** Production site URL for metadata and absolute asset resolution (Vercel sets VERCEL_URL). */
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
  (process.env.VERCEL_URL?.trim()
    ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
    : "") ||
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(`${siteUrl.replace(/\/$/, "")}/`),
  title: {
    default: "AgencyOS",
    template: "%s | AgencyOS",
  },
  description: "OnePixle Agency Operations Dashboard",
  manifest: "/manifest.json",
  icons: {
    icon: "/Logo1.png",
    apple: "/Logo1.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AgencyOS",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // #region agent log
  fetch("http://127.0.0.1:7586/ingest/f36359f2-dfc4-4756-b665-25acb344ba34", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "ddf37f" },
    body: JSON.stringify({
      sessionId: "ddf37f",
      location: "app/layout.tsx:RootLayout",
      message: "RootLayout entered (globals.css imported at module top)",
      data: { nodeEnv: process.env.NODE_ENV },
      timestamp: Date.now(),
      runId: "css-debug",
      hypothesisId: "H2-H3",
    }),
  }).catch(() => {});
  // #endregion
  const locale = await getLocale();
  const messages = await getMessages();
  const isRTL = locale === "ar";
  const fontClass = `${ibmPlexSans.variable} ${ibmPlexSansArabic.variable}`;

  return (
    <html lang={locale} dir={isRTL ? "rtl" : "ltr"} suppressHydrationWarning>
      <body
        className={cn(fontClass, "min-h-screen bg-background antialiased")}
        dir={isRTL ? "rtl" : "ltr"}
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
