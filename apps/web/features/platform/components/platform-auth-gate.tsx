"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, LogIn } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api/client";
import { getPlatformMe } from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import {
  isPlatformSessionExpired,
  usePlatformAuthStore
} from "@/lib/platform/platform-auth-store";

type PlatformAuthGateProps = {
  children: ReactNode;
};

export function PlatformAuthGate({ children }: PlatformAuthGateProps) {
  const t = useTranslations("platform");
  const accessToken = usePlatformAuthStore((state) => state.accessToken);
  const expiresAt = usePlatformAuthStore((state) => state.expiresAt);
  const setFromContext = usePlatformAuthStore((state) => state.setFromContext);
  const clearSession = usePlatformAuthStore((state) => state.clearSession);
  const isExpired = isPlatformSessionExpired(expiresAt);
  const platformQuery = useQuery({
    queryKey: platformQueryKeys.me(),
    queryFn: () => getPlatformMe(accessToken ?? ""),
    enabled: Boolean(accessToken) && !isExpired,
    retry: false,
    staleTime: 60_000
  });

  useEffect(() => {
    if (isExpired) {
      clearSession();
    }
  }, [clearSession, isExpired]);

  useEffect(() => {
    if (platformQuery.data) {
      setFromContext(platformQuery.data);
    }
  }, [platformQuery.data, setFromContext]);

  useEffect(() => {
    if (
      platformQuery.error instanceof ApiError &&
      (platformQuery.error.status === 401 || platformQuery.error.status === 403)
    ) {
      clearSession();
    }
  }, [clearSession, platformQuery.error]);

  if (!accessToken || isExpired) {
    return (
      <EmptyState
        title={t("auth.loginRequiredTitle")}
        description={t("auth.loginRequiredDescription")}
        action={
          <Link href="/platform/login" className={buttonVariants()}>
            <LogIn className="size-4" aria-hidden="true" />
            {t("auth.platformLogin")}
          </Link>
        }
      />
    );
  }

  if (platformQuery.isPending) {
    return <LoadingState label={t("auth.restoringSession")} />;
  }

  if (platformQuery.isError) {
    return (
      <EmptyState
        title={t("auth.restoreFailedTitle")}
        description={platformQuery.error.message}
        action={
          <Button onClick={clearSession} variant="secondary">
            <AlertTriangle className="size-4" aria-hidden="true" />
            {t("auth.clearSession")}
          </Button>
        }
      />
    );
  }

  return children;
}
