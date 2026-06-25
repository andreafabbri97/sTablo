import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't advertise the framework/version on every response.
  poweredByHeader: false,

  async headers() {
    return [
      {
        // The service worker drives the offline shell and push handling. If a
        // client caches an old /sw.js it can get stuck on a stale worker, so we
        // force the browser to revalidate the script on every load. (Headers
        // are matched before /public files, so this applies to the static file.)
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
