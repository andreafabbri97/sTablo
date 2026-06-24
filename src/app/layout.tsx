import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Sora, Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/layout/site-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { RouteProgress } from "@/components/layout/route-progress";
import { ServiceWorker } from "@/components/service-worker";
import { InstallBanner } from "@/components/install-banner";

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
  applicationName: APP_NAME,
  title: { default: `${APP_NAME} — Tavolino Rimini`, template: `%s · ${APP_NAME}` },
  description: APP_DESC,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_NAME },
  formatDetection: { telephone: false },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon.svg" }],
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
        <Providers>
          <Suspense fallback={null}>
            <RouteProgress />
          </Suspense>
          <SiteHeader />
          <main className="mx-auto w-full max-w-5xl px-4 pb-28 pt-6 md:pb-12">
            {children}
          </main>
          <BottomNav />
          <InstallBanner />
          <ServiceWorker />
        </Providers>
      </body>
    </html>
  );
}
