"use client";

import AuthSessionProvider from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        {children}
        <Toaster richColors closeButton position="top-center" />
      </ThemeProvider>
    </AuthSessionProvider>
  );
}
