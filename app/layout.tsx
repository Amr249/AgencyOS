import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import Providers from "@/components/providers";

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
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}`.replace(/\/$/, "") : undefined);

export const metadata: Metadata = {
  ...(siteUrl ? { metadataBase: new URL(`${siteUrl}/`) } : {}),
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
      <body className={fontClass} dir={isRTL ? "rtl" : "ltr"}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
