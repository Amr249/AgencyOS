const FALLBACK_SAR_TO_EGP = 13.5;

/**
 * Fetches live SAR → EGP exchange rate.
 * Tries exchangerate-api.com first, then open.er-api.com. Cached 1 hour by Next.js.
 */
export async function getSarToEgpRate(): Promise<number> {
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/SAR", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("API error");
    const data = (await res.json()) as { rates?: { EGP?: number } };
    if (typeof data.rates?.EGP === "number") return data.rates.EGP;
  } catch {
    // try alternative
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/SAR", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("API error");
    const data = (await res.json()) as { rates?: { EGP?: number } };
    if (typeof data.rates?.EGP === "number") return data.rates.EGP;
  } catch {
    // fallback
  }
  return FALLBACK_SAR_TO_EGP;
}

/** Formatted amount digits (no symbol). Pair with `SarCurrencyIcon` in UI. */
export { formatAmount } from "./utils";
