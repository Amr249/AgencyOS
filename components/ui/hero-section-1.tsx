"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

import { AnimatedGroup } from "@/components/ui/animated-group";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const transitionVariants = {
  item: {
    hidden: {
      opacity: 0,
      filter: "blur(12px)",
      y: 12,
    },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        type: "spring" as const,
        bounce: 0.3,
        duration: 1.5,
      },
    },
  },
};

export type HeroSection1Props = {
  pill: string;
  pillHref: string;
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaPrimaryHref: string;
  ctaSecondary: string;
  ctaSecondaryHref: string;
  meetCustomersLabel: string;
  heroImageAlt: string;
  /** Light mode screenshot */
  heroImageSrcLight: string;
  /** Dark mode screenshot */
  heroImageSrcDark: string;
  /** Optional full-width night background (dark mode, large screens) */
  nightBackgroundSrc: string;
  showDashboard?: boolean;
  dashboardLabel?: string;
  dashboardHref?: string;
  showPortal?: boolean;
  portalLabel?: string;
  portalHref?: string;
};

const TRUST_LOGOS: { src: string; alt: string; className: string }[] = [
  {
    src: "https://html.tailus.io/blocks/customers/nvidia.svg",
    alt: "Nvidia",
    className: "mx-auto h-5 w-auto dark:invert",
  },
  {
    src: "https://html.tailus.io/blocks/customers/column.svg",
    alt: "Column",
    className: "mx-auto h-4 w-auto dark:invert",
  },
  {
    src: "https://html.tailus.io/blocks/customers/github.svg",
    alt: "GitHub",
    className: "mx-auto h-4 w-auto dark:invert",
  },
  {
    src: "https://html.tailus.io/blocks/customers/nike.svg",
    alt: "Nike",
    className: "mx-auto h-5 w-auto dark:invert",
  },
  {
    src: "https://html.tailus.io/blocks/customers/lemonsqueezy.svg",
    alt: "Lemon Squeezy",
    className: "mx-auto h-5 w-auto dark:invert",
  },
  {
    src: "https://html.tailus.io/blocks/customers/laravel.svg",
    alt: "Laravel",
    className: "mx-auto h-4 w-auto dark:invert",
  },
  {
    src: "https://html.tailus.io/blocks/customers/lilly.svg",
    alt: "Lilly",
    className: "mx-auto h-7 w-auto dark:invert",
  },
  {
    src: "https://html.tailus.io/blocks/customers/openai.svg",
    alt: "OpenAI",
    className: "mx-auto h-6 w-auto dark:invert",
  },
];

export function HeroSection1({
  pill,
  pillHref,
  title,
  subtitle,
  ctaPrimary,
  ctaPrimaryHref,
  ctaSecondary,
  ctaSecondaryHref,
  meetCustomersLabel,
  heroImageAlt,
  heroImageSrcLight,
  heroImageSrcDark,
  nightBackgroundSrc,
  showDashboard = false,
  dashboardLabel = "Dashboard",
  dashboardHref = "/dashboard",
  showPortal = false,
  portalLabel = "Portal",
  portalHref = "/portal",
}: HeroSection1Props) {
  return (
    <main className="overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 isolate z-[2] hidden opacity-50 contain-strict lg:block"
      >
        <div className="absolute start-0 top-0 h-[80rem] w-[35rem] -translate-y-[350px] -rotate-45 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
        <div className="absolute start-0 top-0 h-[80rem] w-56 -rotate-45 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
        <div className="absolute start-0 top-0 h-[80rem] w-56 -translate-y-[350px] -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
      </div>
      <section>
        <div className="relative pt-16 md:pt-24 lg:pt-28">
          <AnimatedGroup
            variants={{
              container: {
                visible: {
                  transition: {
                    delayChildren: 1,
                  },
                },
              },
              item: {
                hidden: {
                  opacity: 0,
                  y: 20,
                },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: {
                    type: "spring",
                    bounce: 0.3,
                    duration: 2,
                  },
                },
              },
            }}
            className="absolute inset-0 -z-20"
          >
            <img
              src={nightBackgroundSrc}
              alt=""
              className="absolute inset-x-0 top-56 -z-20 hidden lg:top-32 dark:lg:block"
              width={2400}
              height={1600}
            />
          </AnimatedGroup>
          <div
            aria-hidden
            className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--background)_75%)]"
          />
          <div className="mx-auto max-w-7xl px-6">
            <div className="text-center sm:mx-auto lg:me-auto lg:mt-0">
              <AnimatedGroup variants={transitionVariants}>
                <Link
                  href={pillHref}
                  className="bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 ps-4 shadow-md shadow-black/5 transition-all duration-300 hover:bg-background dark:border-t-white/5 dark:shadow-zinc-950 dark:hover:border-t-border"
                >
                  <span className="text-foreground text-sm">{pill}</span>
                  <span className="block h-4 w-0.5 border-s bg-white dark:border-background dark:bg-zinc-700" />
                  <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
                    <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0 rtl:translate-x-1/2 rtl:group-hover:translate-x-0">
                      <span className="flex size-6">
                        <ArrowRight className="m-auto size-3 rtl:rotate-180" />
                      </span>
                      <span className="flex size-6">
                        <ArrowRight className="m-auto size-3 rtl:rotate-180" />
                      </span>
                    </div>
                  </div>
                </Link>

                <h1 className="mx-auto mt-8 max-w-4xl text-balance text-4xl font-semibold tracking-tight md:text-6xl md:leading-[1.08] lg:mt-12 xl:text-[5.25rem] xl:leading-[1.05]">
                  {title}
                </h1>
                <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-balance text-lg md:mt-8">
                  {subtitle}
                </p>
              </AnimatedGroup>

              <AnimatedGroup
                variants={{
                  container: {
                    visible: {
                      transition: {
                        staggerChildren: 0.05,
                        delayChildren: 0.75,
                      },
                    },
                  },
                  ...transitionVariants,
                }}
                className="mt-10 flex flex-col flex-wrap items-center justify-center gap-2 md:mt-12 md:flex-row"
              >
                <div className="rounded-[14px] border border-border/60 bg-foreground/10 p-0.5">
                  <Button asChild size="lg" className="rounded-xl px-5 text-base">
                    <Link href={ctaPrimaryHref}>
                      <span className="text-nowrap">{ctaPrimary}</span>
                    </Link>
                  </Button>
                </div>
                <Button asChild size="lg" variant="ghost" className="h-11 rounded-xl px-5">
                  <Link href={ctaSecondaryHref}>
                    <span className="text-nowrap">{ctaSecondary}</span>
                  </Link>
                </Button>
                {showDashboard ? (
                  <Button asChild size="lg" variant="outline" className="h-11 rounded-xl px-5">
                    <Link href={dashboardHref}>
                      <span className="text-nowrap">{dashboardLabel}</span>
                    </Link>
                  </Button>
                ) : null}
                {showPortal ? (
                  <Button asChild size="lg" variant="outline" className="h-11 rounded-xl px-5">
                    <Link href={portalHref}>
                      <span className="text-nowrap">{portalLabel}</span>
                    </Link>
                  </Button>
                ) : null}
              </AnimatedGroup>
            </div>
          </div>

          <AnimatedGroup
            variants={{
              container: {
                visible: {
                  transition: {
                    staggerChildren: 0.05,
                    delayChildren: 0.75,
                  },
                },
              },
              ...transitionVariants,
            }}
          >
            <div className="relative -me-56 mt-8 overflow-hidden px-2 sm:me-0 sm:mt-12 md:mt-16">
              <div
                aria-hidden
                className="absolute inset-0 z-10 bg-gradient-to-b from-transparent from-35% to-background"
              />
              <div className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-border/60 bg-background p-4 shadow-lg shadow-zinc-950/15 ring-1 ring-background dark:shadow-black/40">
                <img
                  className="relative hidden aspect-[15/8] rounded-2xl bg-background dark:block"
                  src={heroImageSrcDark}
                  alt={heroImageAlt}
                  width={2700}
                  height={1440}
                />
                <img
                  className="relative z-[2] aspect-[15/8] rounded-2xl border border-border/25 bg-background dark:hidden"
                  src={heroImageSrcLight}
                  alt={heroImageAlt}
                  width={2700}
                  height={1440}
                />
              </div>
            </div>
          </AnimatedGroup>
        </div>
      </section>
      <section className="bg-background pb-16 pt-12 md:pb-32 md:pt-16">
        <div className="group relative m-auto max-w-5xl px-6">
          <div className="absolute inset-0 z-10 flex scale-95 items-center justify-center opacity-0 duration-500 group-hover:scale-100 group-hover:opacity-100">
            <Link href="/" className="block text-sm duration-150 hover:opacity-75">
              <span>{meetCustomersLabel}</span>
              <ChevronRight className="ms-1 inline-block size-3 rtl:rotate-180" />
            </Link>
          </div>
          <div className="mx-auto mt-10 grid max-w-2xl grid-cols-4 gap-x-12 gap-y-8 transition-all duration-500 group-hover:opacity-50 group-hover:blur-sm sm:mt-12 sm:gap-x-16 sm:gap-y-14">
            {TRUST_LOGOS.map((logo) => (
              <div key={logo.src} className="flex">
                <img className={cn(logo.className)} src={logo.src} alt={logo.alt} height={24} width={100} />
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
