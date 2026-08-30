"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { AlertTriangle, LoaderCircle, RotateCcw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { getCustomerSessionReadiness } from "@/lib/customer/customer-session-readiness";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { useTranslations } from "@/lib/i18n/i18n-provider";

type CustomerSessionGateProps = {
  sessionId: string;
  children: ReactNode;
};

function readinessKey(
  reason:
    | "hydrating"
    | "missing_session"
    | "session_mismatch"
    | "missing_branch"
    | "missing_token"
    | "expired"
) {
  switch (reason) {
    case "expired":
      return "gate.reasons.expired";
    case "session_mismatch":
      return "gate.reasons.sessionMismatch";
    case "missing_branch":
      return "gate.reasons.missingTable";
    case "missing_token":
      return "gate.reasons.missingAccess";
    case "hydrating":
      return "gate.reasons.hydrating";
    default:
      return "gate.reasons.missingSession";
  }
}

export function CustomerSessionGate({
  sessionId,
  children
}: CustomerSessionGateProps) {
  const t = useTranslations("customer");
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
      <section
        className="rounded-[22px] border border-border bg-card p-5"
        aria-live="polite"
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-primary">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-black tracking-[-0.02em] text-foreground">
          {t("gate.restoringTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t("gate.restoringDescription")}
        </p>
      </section>
    );
  }

  if (!readiness.isReady) {
    return (
      <section className="rounded-[22px] border border-warning/35 bg-card p-5">
        <span className="flex size-11 items-center justify-center rounded-full bg-warning/10 text-warning">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-black tracking-[-0.02em] text-foreground">
          {t("gate.reconnectTitle")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {t(readinessKey(readiness.reason))}
        </p>
        <div className="mt-5 grid gap-2">
          <Link
            href="/customer"
            className={`${buttonVariants()} min-h-11 w-full rounded-xl !bg-primary !text-primary-foreground`}
          >
            {t("gate.openTableEntry")}
          </Link>
          <Button
            variant="secondary"
            onClick={clearSession}
            className="min-h-11 w-full rounded-xl"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            {t("gate.resetLocalSession")}
          </Button>
        </div>
      </section>
    );
  }

  return children;
}
