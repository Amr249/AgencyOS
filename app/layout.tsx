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
  icons: {
    icon: "/Logo3.png",
    apple: "/Logo3.png",
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
      </head>
      <body className={cairo.className} dir="rtl">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
