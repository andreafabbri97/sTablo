/**
 * Absolute base URL of the deployment. Used for `metadataBase` so Open Graph /
 * share previews resolve to absolute URLs. Prefers an explicit override, then
 * the stable Vercel production domain (so previews don't poison shared links),
 * then the per-deploy Vercel URL, then localhost for dev.
 */
export function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  const vercel = process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
