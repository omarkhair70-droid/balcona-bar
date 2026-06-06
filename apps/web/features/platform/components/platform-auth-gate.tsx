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
import {
  isPlatformSessionExpired,
  usePlatformAuthStore
} from "@/lib/platform/platform-auth-store";

type PlatformAuthGateProps = {
  children: ReactNode;
};

export function PlatformAuthGate({ children }: PlatformAuthGateProps) {
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
        title="Platform login required"
        description="Sign in with a platform admin account before onboarding cafes."
        action={
          <Link href="/platform/login" className={buttonVariants()}>
            <LogIn className="size-4" aria-hidden="true" />
            Platform login
          </Link>
        }
      />
    );
  }

  if (platformQuery.isPending) {
    return <LoadingState label="Restoring platform session" />;
  }

  if (platformQuery.isError) {
    return (
      <EmptyState
        title="Platform session could not be restored"
        description={platformQuery.error.message}
        action={
          <Button onClick={clearSession} variant="secondary">
            <AlertTriangle className="size-4" aria-hidden="true" />
            Clear session
          </Button>
        }
      />
    );
  }

  return children;
}
