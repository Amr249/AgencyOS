"use client";

import * as React from "react";
import { Settings } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface SiriOrbProps {
  size?: string;
  className?: string;
  colors?: {
    bg?: string;
    c1?: string;
    c2?: string;
    c3?: string;
  };
  animationDuration?: number;
}

export function SiriOrb({
  size = "192px",
  className,
  colors,
  animationDuration = 20,
}: SiriOrbProps) {
  const defaultColors = {
    bg: "transparent",
    c1: "#a5ff12",
    c2: "rgba(0, 0, 0, 0.38)",
    c3: "rgba(255, 255, 255, 0.1)",
  };

  const finalColors = { ...defaultColors, ...colors };
  const pxMatch = size.match(/(\d+(?:\.\d+)?)\s*px/i);
  const sizeValue = pxMatch ? Number.parseFloat(pxMatch[1]) : Number.parseFloat(size);
  const safeSize =
    Number.isFinite(sizeValue) && sizeValue > 0 ? sizeValue : 192;

  const blurAmount = Math.max(safeSize * 0.08, 8);
  const contrastAmount = Math.max(safeSize * 0.003, 1.8);

  return (
    <div
      className={cn("siri-orb", className)}
      style={
        {
          width: size,
          height: size,
          "--bg": finalColors.bg,
          "--c1": finalColors.c1,
          "--c2": finalColors.c2,
          "--c3": finalColors.c3,
          "--animation-duration": `${animationDuration}s`,
          "--blur-amount": `${blurAmount}px`,
          "--contrast-amount": contrastAmount,
        } as React.CSSProperties
      }
    >
      <style jsx>{`
        @property --angle {
          syntax: "<angle>";
          inherits: false;
          initial-value: 0deg;
        }

        .siri-orb {
          display: grid;
          grid-template-areas: "stack";
          overflow: hidden;
          border-radius: 50%;
          position: relative;
          background: radial-gradient(
            circle,
            rgba(0, 0, 0, 0.08) 0%,
            rgba(0, 0, 0, 0.04) 35%,
            transparent 70%
          );
        }

        :global(.dark) .siri-orb {
          background: radial-gradient(
            circle,
            rgba(255, 255, 255, 0.02) 0%,
            rgba(255, 255, 255, 0.01) 35%,
            transparent 70%
          );
        }

        .siri-orb::before {
          content: "";
          display: block;
          grid-area: stack;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background:
            conic-gradient(
              from calc(var(--angle) * 1.2) at 30% 65%,
              var(--c3) 0deg,
              transparent 45deg 315deg,
              var(--c3) 360deg
            ),
            conic-gradient(
              from calc(var(--angle) * 0.8) at 70% 35%,
              var(--c2) 0deg,
              transparent 60deg 300deg,
              var(--c2) 360deg
            ),
            conic-gradient(
              from calc(var(--angle) * -1.5) at 65% 75%,
              var(--c1) 0deg,
              transparent 90deg 270deg,
              var(--c1) 360deg
            ),
            conic-gradient(
              from calc(var(--angle) * 2.1) at 25% 25%,
              var(--c2) 0deg,
              transparent 30deg 330deg,
              var(--c2) 360deg
            ),
            conic-gradient(
              from calc(var(--angle) * -0.7) at 80% 80%,
              var(--c1) 0deg,
              transparent 45deg 315deg,
              var(--c1) 360deg
            ),
            radial-gradient(
              ellipse 120% 80% at 40% 60%,
              var(--c3) 0%,
              transparent 50%
            );
          filter: blur(var(--blur-amount)) contrast(var(--contrast-amount)) saturate(1.2);
          animation: rotate var(--animation-duration) linear infinite;
          transform: translateZ(0);
          will-change: transform;
        }

        .siri-orb::after {
          content: "";
          display: block;
          grid-area: stack;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: radial-gradient(
            circle at 45% 55%,
            rgba(255, 255, 255, 0.04) 0%,
            rgba(255, 255, 255, 0.02) 30%,
            transparent 60%
          );
          mix-blend-mode: overlay;
        }

        @keyframes rotate {
          from {
            --angle: 0deg;
          }
          to {
            --angle: 360deg;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .siri-orb::before {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export default function SiriOrbDemo() {
  const [selectedSize, setSelectedSize] = React.useState<string>("192px");
  const [animationDuration, setAnimationDuration] = React.useState(20);
  const [showSettings, setShowSettings] = React.useState(false);

  const sizeOptions = [
    { value: "64px", label: "XS" },
    { value: "128px", label: "SM" },
    { value: "192px", label: "MD" },
    { value: "256px", label: "LG" },
    { value: "320px", label: "XL" },
  ];

  return (
    <div className="relative flex min-h-screen min-w-full items-center justify-center bg-gradient-to-br from-white to-gray-100 text-black dark:from-slate-900 dark:to-slate-700 dark:text-white">
      <SiriOrb
        size={selectedSize}
        animationDuration={animationDuration}
        className="drop-shadow-2xl"
      />

      <div className="absolute end-4 bottom-4">
        <Button
          type="button"
          size="icon"
          variant="secondary"
          onClick={() => setShowSettings(!showSettings)}
          className="h-10 w-10 rounded-full bg-pink-500 text-white hover:bg-pink-600 dark:bg-pink-600 dark:hover:bg-pink-500"
          aria-label="Orb settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {showSettings ? (
        <div className="absolute end-4 bottom-[64px] flex w-fit flex-col justify-between gap-4 rounded-lg border border-black/10 bg-white/90 p-4 shadow-xl backdrop-blur-md dark:border-white/20 dark:bg-black/40">
          <div>
            <div className="mb-2 block text-sm font-medium">Size</div>
            <div className="flex flex-wrap gap-2">
              {sizeOptions.map((option) => (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  key={option.value}
                  onClick={() => setSelectedSize(option.value)}
                  className={cn(
                    "h-auto bg-pink-500 px-2 py-1 text-white hover:bg-pink-600 dark:bg-pink-600 dark:hover:bg-pink-500",
                    selectedSize !== option.value && "opacity-50"
                  )}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="animation-speed" className="mb-2 block text-sm font-medium">
              Animation Speed: {animationDuration}s
            </label>
            <input
              id="animation-speed"
              type="range"
              min={5}
              max={40}
              value={animationDuration}
              onChange={(e) => setAnimationDuration(Number(e.target.value))}
              className="siri-orb-slider h-2 w-full min-w-[200px] cursor-pointer appearance-none rounded-lg border border-gray-300 bg-gray-200 dark:border-white/30 dark:bg-white/10"
            />
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .siri-orb-slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: oklch(0.72 0.2 352.53);
          cursor: pointer;
          border: none;
        }

        .siri-orb-slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: oklch(0.72 0.2 352.53);
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
