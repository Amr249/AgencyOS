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
    icon: "/logo-512.png",
    apple: "/logo-512.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "AgencyOS",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const isRTL = locale === "ar";
  const fontClass = `${ibmPlexSans.variable} ${ibmPlexSansArabic.variable}`;

  return (
    <html lang={locale} dir={isRTL ? "rtl" : "ltr"} suppressHydrationWarning>
      <body
        className={cn(fontClass, "min-h-screen bg-background antialiased")}
        dir={isRTL ? "rtl" : "ltr"}
        suppressHydrationWarning
      >
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
