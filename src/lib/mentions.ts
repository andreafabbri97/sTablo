/**
 * @mention parsing — pure, no DB or React, safe to import from client and
 * server. A mention is `@handle` where handle matches the account username
 * rules (lowercase letters, digits, underscore; 3-20 chars). The lookbehind
 * keeps `@` from matching mid-word or after another `@` (so emails and `@@`
 * don't produce false mentions).
 */
export const MENTION_RE = /(?<![a-z0-9_@])@([a-z0-9_]{3,20})/gi;

/** Unique, lowercased handles mentioned in `text`. */
export function extractMentions(text: string): string[] {
  const out = new Set<string>();
  const re = new RegExp(MENTION_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.add(m[1].toLowerCase());
  return [...out];
}

/** A rendered comment is a sequence of plain-text runs and @mention tokens. */
export type MentionSegment =
  | { type: "text"; value: string }
  | { type: "mention"; handle: string; raw: string };

/** Split `text` into text/mention segments, in order, for linkified rendering. */
export function tokenizeMentions(text: string): MentionSegment[] {
  const segs: MentionSegment[] = [];
  let last = 0;
  const re = new RegExp(MENTION_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) segs.push({ type: "text", value: text.slice(last, m.index) });
    segs.push({ type: "mention", handle: m[1].toLowerCase(), raw: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ type: "text", value: text.slice(last) });
  return segs;
}
