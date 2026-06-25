/**
 * PWA install/display helpers shared by the install banner and the push prompt
 * so both judge "is the app already installed?" and "is this iOS?" identically.
 * All functions are browser-only and safe to call during SSR (they return
 * false when `window`/`navigator` is unavailable).
 */

/** Display modes a browser reports when the PWA runs as an installed app. */
const INSTALLED_DISPLAY_MODES = [
  "standalone",
  "minimal-ui",
  "fullscreen",
  "window-controls-overlay",
] as const;

/** True when the page is running as an installed PWA (any platform). */
export function isInstalled(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  const displayMatch = INSTALLED_DISPLAY_MODES.some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches,
  );
  // iOS Safari doesn't honor the display-mode query; it exposes this instead.
  const iosStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return displayMatch || iosStandalone;
}

/** True for iOS/iPadOS regardless of which browser is running. */
export function isIOSDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iphone|ipod|ipad/i.test(ua)) return true;
  // iPadOS 13+ reports a desktop "Macintosh" UA; betray it via touch support.
  return /macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
}

/**
 * True only on the iOS browser that can actually "Add to Home Screen" — real
 * Safari. iOS Chrome/Firefox/Edge and in-app webviews (Instagram, Facebook,
 * Line…) can't install PWAs, so offering them the Share-sheet instructions
 * would just be misleading.
 */
export function canIOSInstall(): boolean {
  if (!isIOSDevice()) return false;
  const ua = navigator.userAgent.toLowerCase();
  // Tokens that mark a non-Safari iOS browser or an in-app webview.
  const nonSafari =
    /crios|fxios|edgios|opios|opt\/|mercury|gsa\/|fban|fbav|fb_iab|instagram|line\/|micromessenger|whatsapp/;
  return !nonSafari.test(ua);
}
