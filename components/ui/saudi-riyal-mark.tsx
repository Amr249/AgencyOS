import Image from "next/image";
import { cn } from "@/lib/utils";

type SaudiRiyalMarkProps = {
  className?: string;
  /** Approximate height in CSS pixels (width scales with asset aspect ratio). */
  size?: number;
};

/** Official-style Saudi Riyal mark (`public/Saudi_Riyal_Symbol.png`). Decorative next to numerals. */
export function SaudiRiyalMark({ className, size = 28 }: SaudiRiyalMarkProps) {
  return (
    <Image
      src="/Saudi_Riyal_Symbol.png"
      alt=""
      width={size}
      height={size}
      className={cn("object-contain", className)}
      aria-hidden
    />
  );
}
