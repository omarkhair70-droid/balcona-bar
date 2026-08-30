"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, LoaderCircle, QrCode } from "lucide-react";
import { CopyDebugReportButton } from "@/components/debug/copy-debug-report-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
import { formatErrorMessage } from "@/lib/api/error-message";
import { startTableSession } from "@/lib/api/endpoints";
import { withCustomerTransientRetry } from "@/lib/customer/customer-api-reliability";
import { assertCustomerSessionReady } from "@/lib/customer/customer-session-readiness";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CustomerShell } from "@/features/customer/customer-shell";

const TABLE_SESSION_START_TIMEOUT_MS = 12_000;
const TABLE_SESSION_START_MAX_FAILURES = 3;

type CustomerTableStartPageProps = {
  qrToken: string;
};

function tableStartErrorMessage(
  error: unknown,
  qrToken: string,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (error instanceof ApiError) {
    if (error.status === 404) {
      return t("errors.tableNotFound", { token: qrToken });
    }

    if (error.status === 0) {
      return t("errors.tableConnectionSlow");
    }

    if (error.status >= 500) {
      return t("errors.tableTemporarilyUnavailable");
    }
  }

  return formatErrorMessage(
    error,
    t("errors.tableLinkFallback"),
  );
}

export function CustomerTableStartPage({
  qrToken
}: CustomerTableStartPageProps) {
  const router = useRouter();
  const t = useTranslations("customer");
  const setFromStartResult = useCustomerSessionStore(
    (state) => state.setFromStartResult
  );
  const startMutation = useMutation({
    mutationFn: async () => {
      const result = await withCustomerTransientRetry(
        () =>
          startTableSession(
            { qrToken },
            { timeoutMs: TABLE_SESSION_START_TIMEOUT_MS },
          ),
        {
          flow: "table_session_start",
          maxAttempts: TABLE_SESSION_START_MAX_FAILURES
        }
      );

      setFromStartResult(qrToken, result);
      assertCustomerSessionReady(
        useCustomerSessionStore.getState(),
        result.session.id
      );

      return result;
    },
    retry: false,
    onSuccess: (result) => {
      router.replace(`/customer/session/${result.session.id}/menu`);
    }
  });
  const { isIdle, mutate } = startMutation;

  useEffect(() => {
    if (!isIdle) {
      return;
    }

    mutate();
  }, [isIdle, mutate]);

  const isRetrying =
    startMutation.isPending && startMutation.failureCount > 0;
  const loadingDescription = isRetrying
    ? t("tableStart.retrying", {
        attempt: startMutation.failureCount + 1,
        max: TABLE_SESSION_START_MAX_FAILURES
      })
    : t("tableStart.loading");
  const errorDescription = startMutation.isError
    ? tableStartErrorMessage(startMutation.error, qrToken, t)
    : "";

  return (
    <CustomerShell
      eyebrow={t("tableStart.eyebrow")}
      title={
        startMutation.isError
          ? t("tableStart.titleError")
          : t("tableStart.titleOpening")
      }
      description={
        startMutation.isError
          ? errorDescription
          : t("tableStart.descriptionOpening")
      }
    >
      <Card
        variant="glass"
        padding="lg"
        className="mb-8"
        aria-live="polite"
      >
        <CardHeader>
          <div className="text-primary">
            {startMutation.isError ? (
              <AlertTriangle className="size-7" aria-hidden="true" />
            ) : (
              <QrCode className="size-7" aria-hidden="true" />
            )}
          </div>
          <CardTitle>
            {startMutation.isError ? t("tableStart.titleError") : qrToken}
          </CardTitle>
          <CardDescription>
            {startMutation.isError ? errorDescription : loadingDescription}
          </CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3 px-6 pb-6">
          {startMutation.isPending ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
              {isRetrying
                ? t("tableStart.retryingConnection")
                : t("tableStart.startingSession")}
            </span>
          ) : null}
          {startMutation.isError ? (
            <>
              <Button onClick={() => startMutation.mutate()}>
                {t("actions.tryAgain")}
              </Button>
              <Button variant="secondary" onClick={() => router.push("/customer")}>
                {t("actions.back")}
              </Button>
              <CopyDebugReportButton
                action="table_session_start"
                flow="customer_table_start"
                error={startMutation.error}
              />
            </>
          ) : null}
        </div>
      </Card>
    </CustomerShell>
  );
}
