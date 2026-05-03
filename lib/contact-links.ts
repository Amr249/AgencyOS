/** AgencyOS sales / support on WhatsApp (E.164 without +). */
export const CONTACT_WHATSAPP_E164 = "966547014904";

export const CONTACT_WHATSAPP_URL = `https://wa.me/${CONTACT_WHATSAPP_E164}`;

export function contactWhatsAppHref(prefill?: string): string {
  const q = prefill?.trim();
  if (!q) return CONTACT_WHATSAPP_URL;
  return `${CONTACT_WHATSAPP_URL}?text=${encodeURIComponent(q)}`;
}

/** Open WhatsApp chat to an arbitrary phone (CRM / team member). Digits only for `wa.me`. */
export function buildWhatsAppChatUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return CONTACT_WHATSAPP_URL;
  return `https://wa.me/${digits}`;
}

/** Open Gmail compose to a recipient (team / client email). */
export function buildGmailComposeUrl(toEmail: string): string {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail.trim())}`;
}
