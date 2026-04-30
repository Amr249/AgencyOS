import type { Metadata, Viewport } from "next";
import Script from "next/script";
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
  process.env.APP_URL?.trim().replace(/\/$/, "") ||
  (process.env.VERCEL_URL?.trim()
    ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "").replace(/\/$/, "")}`
    : "") ||
  "https://agencyos.pixlesa.com";

export const metadata: Metadata = {
  metadataBase: new URL(`${siteUrl.replace(/\/$/, "")}/`),
  title: {
    default: "AgencyOS",
    template: "%s | AgencyOS",
  },
  description: "OnePixle Agency Operations Dashboard",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon_io%20(3)/favicon.ico", type: "image/x-icon" },
      { url: "/favicon_io%20(3)/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon_io%20(3)/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/favicon_io%20(3)/favicon.ico",
    apple: "/favicon_io%20(3)/apple-touch-icon.png",
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
      <head>
        <Script
          id="strip-fdprocessedid"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){function strip(root){if(!root||!root.querySelectorAll)return;var nodes=root.querySelectorAll('[fdprocessedid]');for(var i=0;i<nodes.length;i++){nodes[i].removeAttribute('fdprocessedid');}}strip(document);var mo=new MutationObserver(function(muts){for(var i=0;i<muts.length;i++){var m=muts[i];if(m.type==='attributes'&&m.attributeName==='fdprocessedid'&&m.target&&m.target.removeAttribute){m.target.removeAttribute('fdprocessedid');continue;}if(m.type==='childList'&&m.addedNodes){for(var j=0;j<m.addedNodes.length;j++){var n=m.addedNodes[j];if(n&&n.nodeType===1){if(n.hasAttribute&&n.hasAttribute('fdprocessedid')){n.removeAttribute('fdprocessedid');}strip(n);}}}}});mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['fdprocessedid']});})();`,
          }}
        />
      </head>
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
