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

const configuredApiUpstream =
  process.env.BALCONA_API_ORIGIN ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:3000/api/v1";

let apiUpstreamUrl;

try {
  apiUpstreamUrl = new URL(configuredApiUpstream);
} catch {
  throw new Error(
    "BALCONA_API_ORIGIN / NEXT_PUBLIC_API_BASE_URL must be an absolute API URL."
  );
}

if (!["http:", "https:"].includes(apiUpstreamUrl.protocol)) {
  throw new Error("Balcona API upstream must use http or https.");
}

const apiUpstreamBase = apiUpstreamUrl.toString().replace(/\/$/, "");

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return legacyRouteRedirects;
  },
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${apiUpstreamBase}/:path*`
      },
      ...canonicalRouteRewrites
    ];
  }
};

export default withPWA(nextConfig);
