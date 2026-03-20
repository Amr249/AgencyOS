import Image from "next/image";
import type { CSSProperties } from "react";

type SarCurrencyIconProps = {
  className?: string;
  imageStyle?: CSSProperties;
};

export function SarCurrencyIcon({
  className = "",
  imageStyle,
}: SarCurrencyIconProps) {
  return (
    <span
      aria-hidden
      title="Saudi Riyal"
      className={`inline-flex items-center ${className}`.trim()}
    >
      <Image
        src="/Saudi_Riyal_Symbol.png"
        alt=""
        width={14}
        height={14}
        className="inline-block h-[0.95em] w-auto object-contain"
        style={imageStyle}
      />
    </span>
  );
}
