import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const cairo = Cairo({ subsets: ["arabic", "latin"] });

export const metadata: Metadata = {
  title: {
    default: "AgencyOS",
    template: "%s | AgencyOS",
  },
  description: "OnePixle Agency Operations Dashboard",
  manifest: "/manifest.json",
  icons: {
    icon: "/Logo3.png",
    apple: "/Logo3.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AgencyOS",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/Logo3.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AgencyOS" />
        <link rel="apple-touch-icon" href="/Logo3.png" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className={cairo.className} dir="rtl">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
