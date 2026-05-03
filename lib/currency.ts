/** Approximate SAR peg (1 USD ≈ 3.75 SAR). */
const FALLBACK_SAR_TO_USD = 1 / 3.75;

/**
 * Fetches live SAR → USD exchange rate.
 * Tries exchangerate-api.com first, then open.er-api.com. Cached 1 hour by Next.js.
 */
export async function getSarToUsdRate(): Promise<number> {
  try {
    const res = await fetch("https://api.exchangerate-api.com/v4/latest/SAR", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("API error");
    const data = (await res.json()) as { rates?: { USD?: number } };
    if (typeof data.rates?.USD === "number") return data.rates.USD;
  } catch {
    // try alternative
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/SAR", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error("API error");
    const data = (await res.json()) as { rates?: { USD?: number } };
    if (typeof data.rates?.USD === "number") return data.rates.USD;
  } catch {
    // fallback
  }
  return FALLBACK_SAR_TO_USD;
}

/** Formatted amount digits (no symbol). Pair with `SarCurrencyIcon` in UI. */
export { formatAmount } from "./utils";
