import { z } from "zod";

const webAppEnvironments = ["development", "test", "staging", "production"] as const;

const apiBaseUrlSchema = z.string().refine(
  (value) =>
    value.startsWith("/") ||
    z.string().url().safeParse(value).success,
  "API base URL must be an absolute URL or a same-origin path"
);

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: apiBaseUrlSchema.default(
    "http://localhost:3000/api/v1"
  ),
  NEXT_PUBLIC_APP_ENV: z.enum(webAppEnvironments).default("development"),
  NEXT_PUBLIC_APP_VERSION: z.string().default("0.1.0"),
  NEXT_PUBLIC_GIT_SHA: z.string().default("local"),
  NEXT_PUBLIC_BUILD_TIME: z.string().default("not_provided"),
  NEXT_PUBLIC_DEMO_SANDBOX_URL: z.string().default("")
});

function webAppEnvironment() {
  if (process.env.NEXT_PUBLIC_APP_ENV) {
    return process.env.NEXT_PUBLIC_APP_ENV;
  }

  if (
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "production"
  ) {
    return "staging";
  }

  return "development";
}

const configuredApiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api/v1";
const resolvedWebAppEnvironment = webAppEnvironment();
const useHostedApiProxy =
  resolvedWebAppEnvironment === "staging" ||
  resolvedWebAppEnvironment === "production" ||
  process.env.VERCEL_ENV === "preview" ||
  process.env.VERCEL_ENV === "production";

export const configuredApiUpstreamBaseUrl = configuredApiBaseUrl;

export const env = envSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: useHostedApiProxy
    ? "/api/backend"
    : configuredApiBaseUrl,
  NEXT_PUBLIC_APP_ENV: resolvedWebAppEnvironment,
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
  NEXT_PUBLIC_GIT_SHA:
    process.env.NEXT_PUBLIC_GIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "local",
  NEXT_PUBLIC_BUILD_TIME:
    process.env.NEXT_PUBLIC_BUILD_TIME ?? process.env.BUILD_TIME ?? "not_provided",
  NEXT_PUBLIC_DEMO_SANDBOX_URL:
    process.env.NEXT_PUBLIC_DEMO_SANDBOX_URL ?? ""
});

export type ApiBaseUrlSafety = {
  status: "permanent" | "temporary";
  reason: string;
  host: string;
};

function isLocalhost(hostname: string) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

export function getApiBaseUrlSafety(
  value = env.NEXT_PUBLIC_API_BASE_URL
): ApiBaseUrlSafety {
  if (value.startsWith("/")) {
    return {
      status: "permanent",
      reason: "API traffic uses the same-origin Balcona proxy",
      host: "same-origin"
    };
  }

  const url = new URL(value);
  const host = url.hostname.toLowerCase();

  if (isLocalhost(host)) {
    return {
      status: "temporary",
      reason: "localhost is only valid for local development",
      host
    };
  }

  if (host.endsWith(".trycloudflare.com")) {
    return {
      status: "temporary",
      reason: "Cloudflare Tunnel quick links change when the tunnel restarts",
      host
    };
  }

  return {
    status: "permanent",
    reason: "API URL uses a stable public host",
    host
  };
}

export function getDemoSandboxHref() {
  const value = env.NEXT_PUBLIC_DEMO_SANDBOX_URL.trim();

  if (!value) {
    return null;
  }

  if (value.startsWith("/")) {
    return value;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

function isHostedStagingOrProduction() {
  return (
    env.NEXT_PUBLIC_APP_ENV === "staging" ||
    env.NEXT_PUBLIC_APP_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "production"
  );
}

const apiBaseSafety = getApiBaseUrlSafety();

if (isHostedStagingOrProduction() && apiBaseSafety.status === "temporary") {
  throw new Error(
    `NEXT_PUBLIC_API_BASE_URL cannot use ${apiBaseSafety.host} for ${env.NEXT_PUBLIC_APP_ENV} web deployments. Use a stable public API URL.`
  );
}
