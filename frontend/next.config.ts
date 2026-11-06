import type { NextConfig } from "next";

/**
 * Where the website's server forwards /api/* requests. The browser only ever talks to the website,
 * so one public URL (e.g. an ngrok tunnel to port 3000) serves both the pages and live data.
 * Override with BACKEND_URL when the API runs elsewhere (read when the dev server / build starts).
 */
const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  redirects() {
    return [
      // The Minimum ("Where") page is the landing page.
      { source: "/", destination: "/minimum", permanent: false },
      { source: "/where", destination: "/minimum", permanent: false },
      { source: "/when", destination: "/intermediate", permanent: false },
      { source: "/moses-south", destination: "/advanced", permanent: false },
    ];
  },
  rewrites() {
    // Proxy the FastAPI backend under the same origin (no CORS needed, works through tunnels).
    return [{ source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` }];
  },
};

export default nextConfig;
