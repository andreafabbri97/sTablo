/**
 * Avatars are stored in the DB as base64 data-URLs. Embedding those inline in
 * every payload (each match card, ranking row, picker…) bloats the HTML/RSC by
 * hundreds of KB — the same avatar is serialized once per appearance, which is
 * slow to download, parse and hydrate. Instead, expose each avatar at a stable,
 * cacheable URL (`/api/avatar/[id]`) so the payload carries a ~40-byte link and
 * the browser fetches+caches each image once.
 */

/** Small stable hash (djb2 → base36) to bust the cache when the avatar changes. */
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/**
 * Turn a player's stored avatar into a `src` for <Avatar imageUrl>:
 * - a base64 data-URL → `/api/avatar/<id>?v=<hash>` (served + cached separately)
 * - an already-external URL → returned as-is
 * - nothing → null (Avatar shows the colored initials)
 */
export function avatarSrc(
  id: string,
  stored: string | null | undefined,
): string | null {
  if (!stored) return null;
  if (!stored.startsWith("data:")) return stored;
  return `/api/avatar/${id}?v=${hash(stored)}`;
}
