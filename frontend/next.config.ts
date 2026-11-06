import type { NextConfig } from "next";

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
};

export default nextConfig;
