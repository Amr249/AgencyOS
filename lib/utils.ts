import { type ClassValue, clsx } from "clsx";
import { Metadata } from "next";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateAvatarFallback(string: string) {
  const names = string.split(" ").filter((name: string) => name);
  const mapped = names.map((name: string) => name.charAt(0).toUpperCase());

  return mapped.join("");
}

/** Formatted number only (no currency suffix). Use with SarMoney for SAR display. */
export function formatBudgetSAR(value: string | null | undefined): string {
  return formatAmount(value);
}

/** Format numeric amount without currency suffix. Returns "—" for null/empty/invalid. */
export function formatAmount(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Format date as DD/MM/YYYY (Western numerals). */
export function formatDate(dateStr: string | null | undefined): string {
  if (dateStr == null || dateStr === "") return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function generateMeta({
  title,
  description,
}: {
  title: string;
  description: string;
}): Metadata {
  return {
    title: `${title} - Shadcn UI Kit Free Dashboard Template`,
    description: description,
    openGraph: {
      images: [`/seo.jpg`]
    }
  };
}
