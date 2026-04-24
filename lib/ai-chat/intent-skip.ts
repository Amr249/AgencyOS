/**
 * Skip DB retrieval for obvious non-business utterances to save latency.
 */

const CHITCHAT =
  /^(hi|hello|hey|thanks|thank you|ok|okay|bye|goodbye|yes|no|sure|lol|haha|مرحبا|السلام عليكم|شكرا|شكراً|تمام|حسنا|مع السلامة|هاي)(\s*[!.،,]?\s*)$/i;

const VERY_SHORT_MAX = 24;

export function shouldSkipRetrieval(userText: string): boolean {
  const t = userText.trim();
  if (!t) return true;
  if (t.length <= 2) return true;
  if (t.length <= VERY_SHORT_MAX && CHITCHAT.test(t)) return true;
  if (t.length <= 8 && /^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]+$/u.test(t)) {
    return true;
  }
  return false;
}
