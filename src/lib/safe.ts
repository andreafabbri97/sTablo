/**
 * Run a DB query, returning a fallback if it throws (e.g. before the database
 * is provisioned). Keeps pages rendering a friendly empty state instead of a
 * hard 500 during first-time setup.
 */
export async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error("[query]", error);
    return fallback;
  }
}
