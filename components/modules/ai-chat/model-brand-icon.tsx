"use client";

import Image from "next/image";

import { cn } from "@/lib/utils";

export function ModelBrandIcon({
  src,
  className,
}: {
  src: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt=""
      width={16}
      height={16}
      className={cn("size-4 shrink-0 object-contain", className)}
      draggable={false}
    />
  );
}
