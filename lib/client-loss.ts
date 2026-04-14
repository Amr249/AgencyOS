/** Fixed CRM loss categories (stored `won_lost_reason` uses English label). */
export const CLIENT_LOSS_CATEGORIES = ["not_serious", "rejected_work"] as const;
export type ClientLossCategory = (typeof CLIENT_LOSS_CATEGORIES)[number];

export const CLIENT_LOSS_CATEGORY_LABEL_EN: Record<ClientLossCategory, string> = {
  not_serious: "The client wasn't serious",
  rejected_work: "I rejected the work",
};

export function appendClientLossNoteBlock(params: {
  existingNotes: string | null | undefined;
  categoryLabel: string;
  why: string;
  lostDateIso: string;
}): string {
  const { existingNotes, categoryLabel, why, lostDateIso } = params;
  const block = `\n\n--- Lost ${lostDateIso} ---\nCategory: ${categoryLabel}\nWhy: ${why.trim()}\n`;
  return `${(existingNotes ?? "").trim()}${block}`.trim();
}
