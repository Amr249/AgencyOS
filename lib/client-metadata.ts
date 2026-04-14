import {
  CLIENT_SOURCE_VALUES,
  CLIENT_TAG_COLOR_VALUES,
  type ClientSourceValue,
  type ClientTagColorValue,
} from "@/lib/client-constants";

export const CLIENT_SOURCE_OPTIONS: { value: ClientSourceValue; label: string }[] =
  CLIENT_SOURCE_VALUES.map((value) => ({
    value,
    label:
      value === "referral"
        ? "Referral"
        : value === "website"
          ? "Website"
          : value === "proposal"
            ? "Proposal"
            : value === "social_media"
              ? "Social Media"
              : value === "cold_outreach"
                ? "Cold Outreach"
                : "Other",
  }));

export function clientSourceLabel(source: string | null | undefined): string {
  if (!source) return "—";
  const opt = CLIENT_SOURCE_OPTIONS.find((o) => o.value === source);
  return opt?.label ?? source;
}

export const CLIENT_TAG_COLOR_OPTIONS: { value: ClientTagColorValue; label: string }[] =
  CLIENT_TAG_COLOR_VALUES.map((value) => ({
    value,
    label: value.charAt(0).toUpperCase() + value.slice(1),
  }));

function normalizeTagColor(color: string | null | undefined): ClientTagColorValue {
  const c = (color ?? "blue").toLowerCase();
  if ((CLIENT_TAG_COLOR_VALUES as readonly string[]).includes(c)) {
    return c as ClientTagColorValue;
  }
  return "gray";
}

/** Badge styles for client tag chips (solid background + readable text). */
export function clientTagBadgeClass(color: string | null | undefined): string {
  const c = normalizeTagColor(color);
  switch (c) {
    case "blue":
      return "border-transparent bg-blue-100 text-blue-800 hover:bg-blue-100/90";
    case "green":
      return "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100/90";
    case "red":
      return "border-transparent bg-red-100 text-red-800 hover:bg-red-100/90";
    case "purple":
      return "border-transparent bg-purple-100 text-purple-800 hover:bg-purple-100/90";
    case "orange":
      return "border-transparent bg-orange-100 text-orange-900 hover:bg-orange-100/90";
    case "gray":
    default:
      return "border-transparent bg-neutral-200 text-neutral-800 hover:bg-neutral-200/90";
  }
}
