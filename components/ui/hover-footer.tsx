"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Linkedin, MapPin, MessageCircle, Twitter } from "lucide-react";
import { motion } from "motion/react";

import { contactWhatsAppHref } from "@/lib/contact-links";
import { cn } from "@/lib/utils";

/** Brand lime — login / signup / marketing CTAs */
const BRAND = "#a4fe19";

export function TextHoverEffect({
  text,
  duration,
  className,
}: {
  text: string;
  duration?: number;
  className?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const [maskPosition, setMaskPosition] = useState({ cx: "50%", cy: "50%" });
  const uid = useId().replace(/:/g, "");
  const textGradientId = `textGradient-${uid}`;
  const revealMaskId = `revealMask-${uid}`;
  const textMaskId = `textMask-${uid}`;

  useEffect(() => {
    if (!svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const cxPercentage = ((cursor.x - svgRect.left) / svgRect.width) * 100;
    const cyPercentage = ((cursor.y - svgRect.top) / svgRect.height) * 100;
    setMaskPosition({
      cx: `${cxPercentage}%`,
      cy: `${cyPercentage}%`,
    });
  }, [cursor.x, cursor.y]);

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox="0 0 520 120"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={(e) => setCursor({ x: e.clientX, y: e.clientY })}
      className={cn(
        "cursor-pointer select-none uppercase max-md:pointer-events-none max-md:opacity-40",
        className
      )}
      aria-hidden
    >
      <defs>
        <linearGradient id={textGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          {hovered ? (
            <>
              <stop offset="0%" stopColor="#d4ff7a" />
              <stop offset="25%" stopColor={BRAND} />
              <stop offset="50%" stopColor="#8fd814" />
              <stop offset="75%" stopColor="#cfff6a" />
              <stop offset="100%" stopColor="#6aa611" />
            </>
          ) : (
            <>
              <stop offset="0%" stopColor={BRAND} />
              <stop offset="100%" stopColor="#8fd814" />
            </>
          )}
        </linearGradient>

        <motion.radialGradient
          id={revealMaskId}
          gradientUnits="objectBoundingBox"
          r="35%"
          initial={{ cx: 0.5, cy: 0.5 }}
          animate={{
            cx: Number.parseFloat(maskPosition.cx) / 100 || 0.5,
            cy: Number.parseFloat(maskPosition.cy) / 100 || 0.5,
          }}
          transition={{ duration: duration ?? 0.08, ease: "easeOut" }}
        >
          <stop offset="0%" stopColor="white" />
          <stop offset="100%" stopColor="black" />
        </motion.radialGradient>

        <mask id={textMaskId}>
          <rect x="0" y="0" width="100%" height="100%" fill={`url(#${revealMaskId})`} />
        </mask>
      </defs>

      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.35"
        className="fill-transparent stroke-zinc-600 font-sans text-7xl font-bold"
        style={{ opacity: hovered ? 0.55 : 0 }}
      >
        {text}
      </text>

      <motion.text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        strokeWidth="0.35"
        className="fill-transparent font-sans text-7xl font-bold"
        stroke={BRAND}
        style={{ strokeOpacity: 0.85 }}
        initial={{ strokeDashoffset: 1200, strokeDasharray: 1200 }}
        animate={{
          strokeDashoffset: 0,
          strokeDasharray: 1200,
        }}
        transition={{
          duration: 4,
          ease: "easeInOut",
        }}
      >
        {text}
      </motion.text>

      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="middle"
        stroke={`url(#${textGradientId})`}
        strokeWidth="0.35"
        mask={`url(#${textMaskId})`}
        className="fill-transparent font-sans text-7xl font-bold"
      >
        {text}
      </text>
    </svg>
  );
}

export function FooterBackgroundGradient() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        background: `radial-gradient(125% 125% at 50% 10%, rgba(0,0,0,0.55) 50%, ${BRAND}29 100%)`,
      }}
    />
  );
}

const WHATSAPP_HREF = contactWhatsAppHref("AgencyOS");

export default function MarketingHoverFooter() {
  const t = useTranslations("marketing.footer");
  const hoverWord = t("hoverWord");

  const productLinks = [
    { label: t("linkFeatures"), href: "#features" },
    { label: t("linkPricing"), href: "#pricing" },
    { label: t("linkLogin"), href: "/login" },
    { label: t("linkSignup"), href: "/signup" },
  ];

  const legalLinks = [
    { label: t("privacy"), href: "/privacy" },
    { label: t("terms"), href: "/terms" },
    { label: t("contactEmailCta"), href: WHATSAPP_HREF },
  ];

  const socialLinks = [
    { icon: Twitter, label: t("twitter"), href: "https://twitter.com" },
    { icon: Linkedin, label: t("linkedin"), href: "https://linkedin.com" },
  ];

  return (
    <footer className="relative mx-4 mb-8 mt-4 overflow-hidden rounded-3xl border border-white/10 bg-black md:mx-8">
      <div className="relative z-[2] mx-auto max-w-7xl px-6 py-12 md:p-14">
        <div className="grid grid-cols-1 gap-12 pb-12 md:grid-cols-2 md:gap-8 lg:grid-cols-4 lg:gap-16">
          <div className="flex flex-col gap-4">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/Logo1.png"
                alt="AgencyOS"
                width={48}
                height={48}
                className="size-12 shrink-0 rounded-lg"
              />
              <span className="text-2xl font-bold tracking-tight text-white">AgencyOS</span>
            </Link>
            <p className="text-sm leading-relaxed text-zinc-400">{t("hoverIntro")}</p>
            <p className="text-xs text-zinc-500">{t("tagline")}</p>
          </div>

          <div>
            <h4 className="mb-6 text-lg font-semibold text-white">{t("colProductTitle")}</h4>
            <ul className="space-y-3 text-sm">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-zinc-400 transition-colors hover:text-[#a4fe19]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-lg font-semibold text-white">{t("colLegalTitle")}</h4>
            <ul className="space-y-3 text-sm">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  {link.href.startsWith("https://wa.me") ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-400 transition-colors hover:text-[#a4fe19]"
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-zinc-400 transition-colors hover:text-[#a4fe19]"
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-lg font-semibold text-white">{t("contactTitle")}</h4>
            <ul className="space-y-4 text-sm">
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 size-[18px] shrink-0 text-[#a4fe19]" aria-hidden />
                <a
                  href={WHATSAPP_HREF}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-zinc-400 transition-colors hover:text-[#a4fe19]"
                >
                  +966 54 701 4904
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-[18px] shrink-0 text-[#a4fe19]" aria-hidden />
                <span className="text-zinc-400">{t("contactRegion")}</span>
              </li>
            </ul>
          </div>
        </div>

        <hr className="my-8 border-zinc-800" />

        <div className="flex flex-col items-center justify-between gap-4 text-sm text-zinc-500 md:flex-row md:gap-0">
          <div className="flex gap-6">
            {socialLinks.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-zinc-500 transition-colors hover:text-[#a4fe19]"
              >
                <Icon className="size-5" />
              </a>
            ))}
          </div>
          <p className="text-center text-zinc-400 md:text-end">
            © {new Date().getFullYear()} {t("copyrightLine")}
          </p>
        </div>
      </div>

      <div className="-mb-36 -mt-52 hidden h-[30rem] lg:flex">
        <TextHoverEffect text={hoverWord} className="z-[3] w-full" duration={0.12} />
      </div>

      <FooterBackgroundGradient />
    </footer>
  );
}
