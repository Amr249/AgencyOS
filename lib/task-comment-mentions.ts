/** Stored format: @[Display Name](team-member-uuid) */
export const MENTION_TOKEN_REGEX =
  /@\[([^\]]*)\]\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)/gi;

export type CommentSegment =
  | { type: "text"; value: string }
  | { type: "mention"; name: string; memberId: string };

export function parseCommentMentions(body: string): CommentSegment[] {
  const segments: CommentSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(MENTION_TOKEN_REGEX.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIndex) {
      segments.push({ type: "text", value: body.slice(lastIndex, m.index) });
    }
    segments.push({ type: "mention", name: m[1] ?? "", memberId: m[2] ?? "" });
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) {
    segments.push({ type: "text", value: body.slice(lastIndex) });
  }
  if (segments.length === 0) {
    segments.push({ type: "text", value: body });
  }
  return segments;
}

export function buildMentionToken(name: string, memberId: string): string {
  const safe = name.replace(/\]/g, "").trim() || "Member";
  return `@[${safe}](${memberId})`;
}

/**
 * Match an in-progress @mention before the cursor: `@query` not part of a stored `@[Name](uuid)` token.
 * `@` must follow a word boundary (start or whitespace). Query cannot include `[`.
 */
export function matchActiveMentionQuery(textBeforeCursor: string): {
  atIndex: number;
  query: string;
} | null {
  const m = textBeforeCursor.match(/(?<!\S)@([^\s@\[]*)$/);
  if (!m || m.index === undefined) return null;
  return { atIndex: m.index, query: m[1] ?? "" };
}
