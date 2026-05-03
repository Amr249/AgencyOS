"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Point = { x: number; y: number };

interface WaveConfig {
  offset: number;
  amplitude: number;
  frequency: number;
  color: string;
  opacity: number;
}

/** Brand lime — login / marketing CTAs */
const BR = 164;
const BG = 254;
const BB = 25;
const brandRgb = (a: number) => `rgba(${BR},${BG},${BB},${a})`;

export type GlowyWavesHeroProps = {
  pill: string;
  titleLine1: string;
  titleLine2: string;
  subtitle: string;
  ctaPrimary: string;
  ctaPrimaryHref: string;
  ctaSecondary: string;
  ctaSecondaryHref: string;
  pills: string[];
  stats: { label: string; value: string }[];
  showDashboard?: boolean;
  dashboardLabel?: string;
  dashboardHref?: string;
  showPortal?: boolean;
  portalLabel?: string;
  portalHref?: string;
  className?: string;
};

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, staggerChildren: 0.12 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const statsVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: "easeOut", staggerChildren: 0.08 },
  },
};

export function GlowyWavesHero({
  pill,
  titleLine1,
  titleLine2,
  subtitle,
  ctaPrimary,
  ctaPrimaryHref,
  ctaSecondary,
  ctaSecondaryHref,
  pills,
  stats,
  showDashboard = false,
  dashboardLabel = "Dashboard",
  dashboardHref = "/dashboard",
  showPortal = false,
  portalLabel = "Portal",
  portalHref = "/portal",
  className,
}: GlowyWavesHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef<Point>({ x: 0, y: 0 });
  const targetMouseRef = useRef<Point>({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;

    let animationId = 0;
    let time = 0;

    const computeThemeColors = () => {
      const rootStyles = getComputedStyle(document.documentElement);

      const resolveColor = (variables: string[], alpha = 1) => {
        const tempEl = document.createElement("div");
        tempEl.style.position = "absolute";
        tempEl.style.visibility = "hidden";
        tempEl.style.width = "1px";
        tempEl.style.height = "1px";
        document.body.appendChild(tempEl);

        let color = `rgba(255, 255, 255, ${alpha})`;

        for (const variable of variables) {
          const value = rootStyles.getPropertyValue(variable).trim();
          if (value) {
            tempEl.style.backgroundColor = `var(${variable})`;
            const computedColor = getComputedStyle(tempEl).backgroundColor;

            if (computedColor && computedColor !== "rgba(0, 0, 0, 0)") {
              if (alpha < 1) {
                const rgbMatch = computedColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
                if (rgbMatch) {
                  color = `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${alpha})`;
                } else {
                  color = computedColor;
                }
              } else {
                color = computedColor;
              }
              break;
            }
          }
        }

        document.body.removeChild(tempEl);
        return color;
      };

      const fgMuted = resolveColor(["--muted-foreground", "--foreground"], 0.35);

      return {
        backgroundTop: resolveColor(["--background"], 1),
        backgroundBottom: resolveColor(["--muted", "--background"], 0.95),
        wavePalette: [
          {
            offset: 0,
            amplitude: 70,
            frequency: 0.003,
            color: brandRgb(0.9),
            opacity: 0.5,
          },
          {
            offset: Math.PI / 2,
            amplitude: 90,
            frequency: 0.0026,
            color: brandRgb(0.75),
            opacity: 0.4,
          },
          {
            offset: Math.PI,
            amplitude: 60,
            frequency: 0.0034,
            color: brandRgb(0.55),
            opacity: 0.32,
          },
          {
            offset: Math.PI * 1.5,
            amplitude: 80,
            frequency: 0.0022,
            color: fgMuted,
            opacity: 0.28,
          },
          {
            offset: Math.PI * 2,
            amplitude: 55,
            frequency: 0.004,
            color: resolveColor(["--foreground"], 0.22),
            opacity: 0.2,
          },
        ] satisfies WaveConfig[],
      };
    };

    let themeColors = computeThemeColors();

    const handleThemeMutation = () => {
      themeColors = computeThemeColors();
    };

    const observer = new MutationObserver(handleThemeMutation);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const mouseInfluence = prefersReducedMotion ? 10 : 70;
    const influenceRadius = prefersReducedMotion ? 160 : 320;
    const smoothing = prefersReducedMotion ? 0.04 : 0.1;

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const recenterMouse = () => {
      const centerPoint = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      mouseRef.current = centerPoint;
      targetMouseRef.current = centerPoint;
    };

    const handleResize = () => {
      resizeCanvas();
      recenterMouse();
    };

    const handleMouseMove = (event: MouseEvent) => {
      targetMouseRef.current = { x: event.clientX, y: event.clientY };
    };

    const handleMouseLeave = () => {
      recenterMouse();
    };

    resizeCanvas();
    recenterMouse();

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    const drawWave = (wave: WaveConfig) => {
      ctx.save();
      ctx.beginPath();

      const w = window.innerWidth;
      const h = window.innerHeight;

      for (let x = 0; x <= w; x += 4) {
        const dx = x - mouseRef.current.x;
        const dy = h / 2 - mouseRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - distance / influenceRadius);
        const mouseEffect =
          influence * mouseInfluence * Math.sin(time * 0.001 + x * 0.01 + wave.offset);

        const y =
          h / 2 +
          Math.sin(x * wave.frequency + time * 0.002 + wave.offset) * wave.amplitude +
          Math.sin(x * wave.frequency * 0.4 + time * 0.003) * (wave.amplitude * 0.45) +
          mouseEffect;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = wave.color;
      ctx.globalAlpha = wave.opacity;
      ctx.shadowBlur = 35;
      ctx.shadowColor = wave.color;
      ctx.stroke();

      ctx.restore();
    };

    const animate = () => {
      time += 1;

      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * smoothing;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * smoothing;

      const w = window.innerWidth;
      const h = window.innerHeight;

      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, themeColors.backgroundTop);
      gradient.addColorStop(1, themeColors.backgroundBottom);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      themeColors.wavePalette.forEach(drawWave);

      animationId = window.requestAnimationFrame(animate);
    };

    animationId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, []);

  return (
    <section
      className={cn(
        "relative isolate flex min-h-[min(100dvh,56rem)] w-full items-center justify-center overflow-hidden bg-background",
        className
      )}
      role="region"
      aria-label={pill}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />

      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute start-1/2 top-0 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-foreground/[0.035] blur-[140px] dark:bg-foreground/[0.06]" />
        <div className="absolute end-0 bottom-0 h-[360px] w-[360px] rounded-full bg-foreground/[0.025] blur-[120px] dark:bg-foreground/[0.05]" />
        <div className="absolute start-1/4 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-[#a4fe19]/[0.08] blur-[150px] dark:bg-[#a4fe19]/[0.12]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-6 py-20 text-center md:px-8 md:py-24 lg:px-12">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="w-full">
          <motion.div
            variants={itemVariants}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/40 bg-background/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-foreground/70 backdrop-blur dark:border-border/60 dark:bg-background/70 dark:text-foreground/80"
          >
            <Sparkles className="size-4 text-[#a4fe19]" aria-hidden />
            {pill}
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="mb-6 text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl"
          >
            {titleLine1}{" "}
            <span className="bg-gradient-to-r from-[#a4fe19] via-[#cfff6a] to-[#8fd814] bg-clip-text text-transparent">
              {titleLine2}
            </span>
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="mx-auto mb-10 max-w-3xl text-pretty text-lg text-foreground/70 md:text-xl lg:text-2xl"
          >
            {subtitle}
          </motion.p>

          <motion.div
            variants={itemVariants}
            className="mb-10 flex flex-col flex-wrap items-center justify-center gap-3 sm:flex-row sm:gap-4"
          >
            <Button
              asChild
              size="lg"
              className="group gap-2 rounded-full bg-[#a4fe19] px-6 text-sm font-semibold uppercase tracking-[0.15em] text-black hover:bg-[#a4fe19]/90 md:px-8 md:text-base md:tracking-[0.2em]"
            >
              <Link href={ctaPrimaryHref}>
                {ctaPrimary}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1 rtl:rotate-180"
                  aria-hidden
                />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-border/40 bg-background/60 px-6 text-sm text-foreground/80 backdrop-blur md:px-8 md:text-base"
            >
              <Link href={ctaSecondaryHref}>{ctaSecondary}</Link>
            </Button>
            {showDashboard ? (
              <Button asChild size="lg" variant="secondary" className="rounded-full px-6 md:px-8">
                <Link href={dashboardHref}>{dashboardLabel}</Link>
              </Button>
            ) : null}
            {showPortal ? (
              <Button asChild size="lg" variant="secondary" className="rounded-full px-6 md:px-8">
                <Link href={portalHref}>{portalLabel}</Link>
              </Button>
            ) : null}
          </motion.div>

          {pills.length > 0 ? (
            <motion.ul
              variants={itemVariants}
              className="mb-12 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white"
            >
              {pills.map((pillText) => (
                <li
                  key={pillText}
                  className="rounded-full border border-white/15 bg-black px-4 py-2 text-white"
                >
                  {pillText}
                </li>
              ))}
            </motion.ul>
          ) : null}

          {stats.length > 0 ? (
            <motion.div
              variants={statsVariants}
              className="grid gap-4 rounded-2xl border border-white/10 bg-black p-6 sm:grid-cols-3"
            >
              {stats.map((stat) => (
                <motion.div key={stat.label} variants={itemVariants} className="space-y-1">
                  <div className="text-xs uppercase tracking-[0.3em] text-white/50">
                    {stat.label}
                  </div>
                  <div className="text-2xl font-semibold text-white md:text-3xl">{stat.value}</div>
                </motion.div>
              ))}
            </motion.div>
          ) : null}
        </motion.div>
      </div>
    </section>
  );
}
