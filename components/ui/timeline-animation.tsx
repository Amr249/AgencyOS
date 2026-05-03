"use client";

import * as React from "react";
import { motion, useInView, type Variants } from "motion/react";

import { cn } from "@/lib/utils";

export type TimelineCustomVariants = {
  hidden: Record<string, unknown>;
  visible: (index: number) => Record<string, unknown>;
};

type TimelineAs = "div" | "h2" | "h3" | "p" | "span";

export type TimelineContentProps = {
  as?: TimelineAs;
  children: React.ReactNode;
  animationNum: number;
  timelineRef: React.RefObject<HTMLElement | null>;
  customVariants: TimelineCustomVariants;
  className?: string;
};

export function TimelineContent({
  as = "div",
  children,
  animationNum,
  timelineRef: _timelineRef,
  customVariants,
  className,
}: TimelineContentProps) {
  const localRef = React.useRef(null);
  const isInView = useInView(localRef, { once: true, amount: 0.2, margin: "0px 0px -8% 0px" });

  const variants = {
    hidden: customVariants.hidden,
    visible: customVariants.visible(animationNum),
  } as Variants;

  const shared = {
    ref: localRef,
    initial: "hidden" as const,
    animate: isInView ? ("visible" as const) : ("hidden" as const),
    variants,
    className: cn(className),
    children,
  };

  switch (as) {
    case "h2":
      return <motion.h2 {...shared} />;
    case "h3":
      return <motion.h3 {...shared} />;
    case "p":
      return <motion.p {...shared} />;
    case "span":
      return <motion.span {...shared} />;
    default:
      return <motion.div {...shared} />;
  }
}
