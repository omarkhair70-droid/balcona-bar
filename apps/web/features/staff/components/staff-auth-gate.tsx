"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, LogIn } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { ApiError } from "@/lib/api/client";
import { staffMe } from "@/lib/api/endpoints";
import { staffQueryKeys } from "@/lib/api/query-keys";
import {
  isStaffSessionExpired,
  useStaffAuthStore
} from "@/lib/staff/staff-auth-store";

type StaffAuthGateProps = {
  children: ReactNode;
};

export function StaffAuthGate({ children }: StaffAuthGateProps) {
  const accessToken = useStaffAuthStore((state) => state.accessToken);
  const expiresAt = useStaffAuthStore((state) => state.expiresAt);
  const setFromContext = useStaffAuthStore((state) => state.setFromContext);
  const clearSession = useStaffAuthStore((state) => state.clearSession);
  const isExpired = isStaffSessionExpired(expiresAt);
  const staffQuery = useQuery({
    queryKey: staffQueryKeys.me(),
    queryFn: () => staffMe(accessToken ?? ""),
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
    if (staffQuery.data) {
      setFromContext(staffQuery.data);
    }
  }, [setFromContext, staffQuery.data]);

  useEffect(() => {
    if (
      staffQuery.error instanceof ApiError &&
      (staffQuery.error.status === 401 || staffQuery.error.status === 403)
    ) {
      clearSession();
    }
  }, [clearSession, staffQuery.error]);

  if (!accessToken || isExpired) {
    return (
      <EmptyState
        title="Staff login required"
        description="Sign in with a staff account before opening cashier operations."
        action={
          <Link href="/staff/login" className={buttonVariants()}>
            <LogIn className="size-4" aria-hidden="true" />
            Staff login
          </Link>
        }
      />
    );
  }

  if (staffQuery.isPending) {
    return <LoadingState label="Restoring staff session" />;
  }

  if (staffQuery.isError) {
    return (
      <EmptyState
        title="Staff session could not be restored"
        description={staffQuery.error.message}
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
