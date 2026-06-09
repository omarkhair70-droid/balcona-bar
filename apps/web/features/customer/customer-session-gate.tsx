"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomerSessionReadiness } from "@/lib/customer/customer-session-readiness";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";

type CustomerSessionGateProps = {
  sessionId: string;
  children: ReactNode;
};

export function CustomerSessionGate({
  sessionId,
  children
}: CustomerSessionGateProps) {
  const hasHydrated = useCustomerSessionStore((state) => state.hasHydrated);
  const storedSessionId = useCustomerSessionStore((state) => state.sessionId);
  const branchId = useCustomerSessionStore((state) => state.branchId);
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const expiresAt = useCustomerSessionStore(
    (state) => state.customerAccessTokenExpiresAt
  );
  const clearSession = useCustomerSessionStore((state) => state.clearSession);
  const readiness = getCustomerSessionReadiness(
    {
      hasHydrated,
      sessionId: storedSessionId,
      branchId,
      customerAccessToken: token,
      customerAccessTokenExpiresAt: expiresAt
    },
    sessionId
  );

  if (!hasHydrated) {
    return (
      <Card variant="glass" padding="lg" aria-live="polite">
        <CardHeader>
          <div className="text-primary">
            <LoaderCircle className="size-7 animate-spin" aria-hidden="true" />
          </div>
          <CardTitle>Restoring your table</CardTitle>
          <CardDescription>
            Opening your saved table access before loading this screen.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!readiness.isReady) {
    return (
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="text-warning">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </div>
          <CardTitle>Reconnect your table</CardTitle>
          <CardDescription>
            {readiness.message}
          </CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3 px-6 pb-6">
          <Link href="/customer" className={buttonVariants()}>
            Open table entry
          </Link>
          <Button variant="secondary" onClick={clearSession}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Reset local session
          </Button>
        </div>
      </Card>
    );
  }

  return children;
}
