import { env } from "@/lib/config/env";

export type WebDebugMetadata = {
  environment: string;
  buildSha: string;
  buildTime: string;
  appVersion: string;
};

export function getWebDebugMetadata(): WebDebugMetadata {
  return {
    environment: env.NEXT_PUBLIC_APP_ENV,
    buildSha: env.NEXT_PUBLIC_GIT_SHA,
    buildTime: env.NEXT_PUBLIC_BUILD_TIME,
    appVersion: env.NEXT_PUBLIC_APP_VERSION
  };
}

export function shouldShowDebugReportControls() {
  return (
    env.NEXT_PUBLIC_APP_ENV === "development" ||
    env.NEXT_PUBLIC_APP_ENV === "staging"
  );
}

