import { unstable_cache } from "next/cache";

/**
 * Single coarse tag for all shared (non-user-specific) read data. Mutations
 * call revalidateTag(DATA_TAG) so the next read repopulates the cache. Writes
 * are rare (admin records a match), so coarse invalidation is fine and keeps
 * navigation instant the rest of the time — most clicks never hit the DB.
 */
export const DATA_TAG = "stablo-data";

export function cachedQuery<T extends (...args: never[]) => Promise<unknown>>(
  fn: T,
  keyParts: string[],
  // Reads stay cached until a mutation calls updateTag(DATA_TAG); a long
  // safety window means a sleeping (free-tier) DB is woken very rarely.
  revalidate: number | false = 3600,
): T {
  return unstable_cache(
    fn as unknown as (...args: unknown[]) => Promise<unknown>,
    keyParts,
    { tags: [DATA_TAG], revalidate },
  ) as unknown as T;
}
