import withPWAInit from "@ducanh2912/next-pwa";
import {
  canonicalRouteRewrites,
  legacyRouteRedirects
} from "./route-authority.mjs";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: false,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/.*\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "balcona-next-static",
          expiration: {
            maxEntries: 96,
            maxAgeSeconds: 60 * 60 * 24 * 30
          }
        }
      }
    ]
  }
});

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return legacyRouteRedirects;
  },
  async rewrites() {
    return canonicalRouteRewrites;
  }
};

export default withPWA(nextConfig);
