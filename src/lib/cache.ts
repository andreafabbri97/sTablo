import { unstable_cache, revalidateTag } from "next/cache";

/**
 * Single coarse tag for all shared (non-user-specific) read data. Mutations
 * call bustDataCache() so the next read repopulates the cache. Writes are rare
 * (admin records a match), so coarse invalidation is fine and keeps navigation
 * instant the rest of the time — most clicks never hit the DB.
 */
export const DATA_TAG = "stablo-data";

/**
 * Tag for the per-account "is blocked?" lookup that runs on every authenticated
 * page (see getCurrentUser). Cached briefly so navigation doesn't hit the DB
 * each time; busted on block/unblock so a ban still takes effect promptly.
 */
export const ACCOUNTS_TAG = "stablo-accounts";

export function cachedQuery<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  keyParts: string[],
  // Reads stay cached until a mutation calls bustDataCache(); a long safety
  // window means a sleeping (free-tier) DB is woken very rarely.
  revalidate: number | false = 3600,
): T {
  return unstable_cache(
    fn as unknown as (...args: unknown[]) => Promise<unknown>,
    keyParts,
    { tags: [DATA_TAG], revalidate },
  ) as unknown as T;
}

/**
 * Invalidate every shared read cache, immediately. This pairs with
 * `unstable_cache` (the model this app uses), which is busted by
 * `revalidateTag` — NOT by `updateTag` (that one only targets `fetch` tags and
 * `'use cache'`/`cacheTag` entries, neither of which we use). We pass
 * `{ expire: 0 }` for read-your-own-writes: the next request blocks for fresh
 * data instead of serving stale content, so an admin sees their change at once.
 * Works in both Server Actions and Route Handlers (unlike `updateTag`, which
 * throws outside a Server Action).
 */
export function bustDataCache(): void {
  revalidateTag(DATA_TAG, { expire: 0 });
}
