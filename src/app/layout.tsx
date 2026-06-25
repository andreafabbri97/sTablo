import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Sora, Inter, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { RouteProgress } from "@/components/layout/route-progress";
import { ServiceWorker } from "@/components/service-worker";
import { InstallBanner } from "@/components/install-banner";
import { PushPrompt } from "@/components/push-prompt";
import { ErrorListener } from "@/components/error-listener";
import { getBaseUrl } from "@/lib/base-url";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});
const mono = Space_Grotesk({ subsets: ["latin"], variable: "--font-mono" });

const APP_NAME = "sTablo";
const APP_DESC =
  "Il campo digitale del tavolino di Rimini: segna le partite, scala la classifica Elo, organizza tornei.";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  applicationName: APP_NAME,
  title: { default: `${APP_NAME} — Tavolino Rimini`, template: `%s · ${APP_NAME}` },
  description: APP_DESC,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_NAME },
  formatDetection: { telephone: false },
  // Icons are intentionally NOT set here: the file conventions
  // src/app/icon.svg (favicon) and src/app/apple-icon.tsx (PNG apple-touch-icon,
  // required because iOS ignores SVG) generate the <link> tags. Setting
  // metadata.icons would suppress those file-convention icons.
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    locale: "it_IT",
    title: `${APP_NAME} — Tavolino Rimini`,
    description: APP_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Tavolino Rimini`,
    description: APP_DESC,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ff6a2c" },
    { media: "(prefers-color-scheme: dark)", color: "#070a0f" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Capture beforeinstallprompt as early as possible — Chrome often fires
            it before React hydrates, and the event can't be retrieved later.
            We stash it on window so <InstallBanner> can show the prompt. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__stabloBIP=e;window.dispatchEvent(new Event('stablo-bip'));});window.addEventListener('appinstalled',function(){window.__stabloBIP=null;});})();",
          }}
        />
        <Providers>
          <a
            href="#contenuto"
            className="sr-only z-50 rounded-lg bg-brand px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            Vai al contenuto
          </a>
          <Suspense fallback={null}>
            <RouteProgress />
          </Suspense>
          <SiteHeader />
          <main
            id="contenuto"
            className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:pb-12"
          >
            {children}
            <SiteFooter />
          </main>
          <BottomNav />
          <InstallBanner />
          <PushPrompt />
          <ServiceWorker />
          <ErrorListener />
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
