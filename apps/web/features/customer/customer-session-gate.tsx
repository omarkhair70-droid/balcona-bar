"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  isCustomerSessionExpired,
  useCustomerSessionStore
} from "@/lib/customer/customer-session-store";

type CustomerSessionGateProps = {
  sessionId: string;
  children: ReactNode;
};

export function CustomerSessionGate({
  sessionId,
  children
}: CustomerSessionGateProps) {
  const storedSessionId = useCustomerSessionStore((state) => state.sessionId);
  const expiresAt = useCustomerSessionStore(
    (state) => state.customerAccessTokenExpiresAt
  );
  const clearSession = useCustomerSessionStore((state) => state.clearSession);
  const isExpired = isCustomerSessionExpired(expiresAt);
  const isDifferentSession = storedSessionId && storedSessionId !== sessionId;

  if (isExpired || isDifferentSession || !storedSessionId) {
    return (
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="text-warning">
            <AlertTriangle className="size-7" aria-hidden="true" />
          </div>
          <CardTitle>Reconnect your table</CardTitle>
          <CardDescription>
            Your local table access is missing, expired, or belongs to another
            session. Open the table link again to resume securely.
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
