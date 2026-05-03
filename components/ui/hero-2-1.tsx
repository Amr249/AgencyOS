"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ArrowRight, ChevronDown, Menu, X, Zap } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

export type Hero2NavItem = {
  label: string;
  href: string;
  hasDropdown?: boolean;
};

export type Hero2Props = {
  /** When false, nav + mobile sheet are omitted (e.g. layout already has a header). */
  showNavigation?: boolean;
  brandName: string;
  /** Optional logo; defaults to Zap in a circle. */
  logo?: ReactNode;
  navItems: Hero2NavItem[];
  loginHref: string;
  signupHref: string;
  dashboardHref?: string;
  loginLabel: string;
  signupLabel: string;
  dashboardLabel?: string;
  showDashboard?: boolean;
  mobileLoginLabel: string;
  mobileSignupLabel: string;
  badge: string;
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaPrimaryHref: string;
  ctaSecondary: string;
  ctaSecondaryHref: string;
  heroImageSrc: string;
  heroImageAlt: string;
};

function NavItem({
  label,
  href,
  hasDropdown,
}: {
  label: string;
  href: string;
  hasDropdown?: boolean;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-white"
    >
      <span>{label}</span>
      {hasDropdown ? <ChevronDown className="size-4 shrink-0 opacity-70" aria-hidden /> : null}
    </a>
  );
}

function MobileNavItem({ label, href, onNavigate }: { label: string; href: string; onNavigate: () => void }) {
  return (
    <a
      href={href}
      onClick={onNavigate}
      className="flex items-center justify-between border-b border-zinc-800 pb-2 text-lg text-white"
    >
      <span>{label}</span>
      <ArrowRight className="size-4 shrink-0 text-zinc-500" aria-hidden />
    </a>
  );
}

export function Hero2({
  showNavigation = true,
  brandName,
  logo,
  navItems,
  loginHref,
  signupHref,
  dashboardHref = "/dashboard",
  loginLabel,
  signupLabel,
  dashboardLabel = "Dashboard",
  showDashboard = false,
  mobileLoginLabel,
  mobileSignupLabel,
  badge,
  title,
  subtitle,
  ctaPrimary,
  ctaPrimaryHref,
  ctaSecondary,
  ctaSecondaryHref,
  heroImageSrc,
  heroImageAlt,
}: Hero2Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const defaultLogo = (
    <div className="flex size-8 items-center justify-center rounded-full bg-white text-black" aria-hidden>
      <Zap className="size-4 fill-black" strokeWidth={1.5} />
    </div>
  );

  return (
    <div className="relative min-h-[min(100vh,56rem)] overflow-hidden bg-black">
      <div className="pointer-events-none absolute -end-60 -top-10 z-0 flex flex-col items-end blur-xl">
        <div className="z-[1] h-[10rem] w-[60rem] rounded-full bg-linear-to-b from-purple-600 to-sky-600 blur-[6rem]" />
        <div className="z-[1] h-[10rem] w-[90rem] rounded-full bg-linear-to-b from-pink-900 to-yellow-400 blur-[6rem]" />
        <div className="z-[1] h-[10rem] w-[60rem] rounded-full bg-linear-to-b from-yellow-600 to-sky-500 blur-[6rem]" />
      </div>
      <div className="bg-noise pointer-events-none absolute inset-0 z-0 opacity-30" aria-hidden />

      <div className="relative z-10">
        {showNavigation ? (
          <>
            <nav className="container mx-auto mt-6 flex items-center justify-between px-4 py-4">
              <Link href="/" className="flex items-center gap-2">
                {logo ?? defaultLogo}
                <span className="text-xl font-bold text-white">{brandName}</span>
              </Link>

              <div className="hidden items-center gap-6 md:flex">
                <div className="flex items-center gap-6">
                  {navItems.map((item) => (
                    <NavItem
                      key={item.href + item.label}
                      label={item.label}
                      href={item.href}
                      hasDropdown={item.hasDropdown}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {showDashboard ? (
                    <Link
                      href={dashboardHref}
                      className="flex h-12 items-center justify-center rounded-full bg-[#a4fe19] px-8 text-base font-medium text-black hover:bg-[#a4fe19]/90"
                    >
                      {dashboardLabel}
                    </Link>
                  ) : (
                    <Link
                      href={loginHref}
                      className="flex h-12 items-center justify-center rounded-full bg-white px-8 text-base font-medium text-black hover:bg-white/90"
                    >
                      {loginLabel}
                    </Link>
                  )}
                </div>
              </div>

              <button
                type="button"
                className="md:hidden"
                onClick={() => setMobileMenuOpen((o) => !o)}
                aria-expanded={mobileMenuOpen}
              >
                <span className="sr-only">Toggle menu</span>
                {mobileMenuOpen ? <X className="size-6 text-white" /> : <Menu className="size-6 text-white" />}
              </button>
            </nav>

            <AnimatePresence>
              {mobileMenuOpen ? (
                <motion.div
                  initial={{ y: "-100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-100%" }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 z-50 flex flex-col bg-black/95 p-4 md:hidden"
                >
                  <div className="flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2" onClick={() => setMobileMenuOpen(false)}>
                      {logo ?? defaultLogo}
                      <span className="text-xl font-bold text-white">{brandName}</span>
                    </Link>
                    <button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                      <X className="size-6 text-white" />
                    </button>
                  </div>
                  <div className="mt-8 flex flex-col gap-6">
                    {navItems.map((item) => (
                      <MobileNavItem
                        key={item.href + item.label}
                        label={item.label}
                        href={item.href}
                        onNavigate={() => setMobileMenuOpen(false)}
                      />
                    ))}
                    <div className="pt-4">
                      {showDashboard ? (
                        <Link
                          href={dashboardHref}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex w-full justify-center rounded-md border border-zinc-700 py-3 text-white hover:bg-white/5"
                        >
                          {dashboardLabel}
                        </Link>
                      ) : (
                        <Link
                          href={loginHref}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex w-full justify-center rounded-md border border-zinc-700 py-3 text-white hover:bg-white/5"
                        >
                          {mobileLoginLabel}
                        </Link>
                      )}
                    </div>
                    {!showDashboard ? (
                      <Link
                        href={signupHref}
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex h-12 items-center justify-center rounded-full bg-white px-8 text-base font-medium text-black hover:bg-white/90"
                      >
                        {mobileSignupLabel}
                      </Link>
                    ) : null}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        ) : null}

        <div className="mx-auto mt-6 flex max-w-fit items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-2 backdrop-blur-sm">
          <span className="text-sm font-medium text-white">{badge}</span>
          <ArrowRight className="size-4 shrink-0 text-white" aria-hidden />
        </div>

        <div className="container mx-auto mt-12 px-4 text-center">
          <h1 className="mx-auto max-w-4xl text-balance text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            {title}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-zinc-400">{subtitle}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-4">
            <Link
              href={ctaPrimaryHref}
              className="flex h-12 items-center justify-center rounded-full bg-[#a4fe19] px-8 text-base font-medium text-black hover:bg-[#a4fe19]/90"
            >
              {ctaPrimary}
            </Link>
            <Link
              href={ctaSecondaryHref}
              className="flex h-12 items-center justify-center rounded-full border border-zinc-600 px-8 text-base font-medium text-white hover:bg-white/10"
            >
              {ctaSecondary}
            </Link>
          </div>

          <div id="hero-preview" className="relative mx-auto my-16 w-full max-w-6xl scroll-mt-28 sm:my-20">
            <div className="pointer-events-none absolute inset-0 rounded-lg bg-white opacity-20 blur-[10rem]" aria-hidden />
            <div className="relative overflow-hidden rounded-lg shadow-md ring-1 ring-white/10">
              <Image
                src={heroImageSrc}
                alt={heroImageAlt}
                width={1920}
                height={1080}
                className="h-auto w-full object-cover grayscale"
                sizes="(max-width: 768px) 100vw, 1152px"
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
