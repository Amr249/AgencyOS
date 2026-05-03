/**
 * Infer horizontal text direction from character scripts (Arabic vs Latin).
 * Used so assistant bubbles render RTL for Arabic-heavy replies and LTR for English-heavy ones.
 */
export function inferTextDirection(text: string): "rtl" | "ltr" {
  let arabic = 0;
  let latin = 0;
  for (const c of text) {
    const cp = c.codePointAt(0);
    if (cp == null) continue;
    if (
      (cp >= 0x0600 && cp <= 0x06ff) ||
      (cp >= 0x0750 && cp <= 0x077f) ||
      (cp >= 0x08a0 && cp <= 0x08ff) ||
      (cp >= 0xfb50 && cp <= 0xfdff) ||
      (cp >= 0xfe70 && cp <= 0xfeff)
    ) {
      arabic++;
      continue;
    }
    if (
      (cp >= 0x0041 && cp <= 0x005a) ||
      (cp >= 0x0061 && cp <= 0x007a) ||
      (cp >= 0x00c0 && cp <= 0x024f)
    ) {
      latin++;
    }
  }
  if (arabic === 0 && latin === 0) return "ltr";
  return arabic >= latin ? "rtl" : "ltr";
}
