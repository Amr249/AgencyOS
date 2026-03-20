/**
 * Builds a wa.me URL. Normalizes common Saudi local mobiles (05xxxxxxxx → 9665xxxxxxxx).
 */
export function buildWhatsAppChatUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  let n = digits;
  if (n.length === 10 && n.startsWith("0")) {
    n = `966${n.slice(1)}`;
  }
  return `https://wa.me/${n}`;
}

/** Opens Gmail compose in the browser with the given recipient prefilled. */
export function buildGmailComposeUrl(to: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to.trim())}`;
}
