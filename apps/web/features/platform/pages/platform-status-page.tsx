"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Server
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import { getSystemInfo } from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import { env, getApiBaseUrlSafety } from "@/lib/config/env";
import { useTranslations } from "@/lib/i18n/i18n-provider";

function apiOriginFromBaseUrl(value: string) {
  const url = new URL(value);

  url.pathname = url.pathname.replace(/\/api\/v1\/?$/i, "") || "/";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

function DetailRow({
  label,
  value,
  fallback
}: {
  label: string;
  value?: string | null;
  fallback: string;
}) {
  return (
    <div className="grid gap-1 border-b border-border/70 py-3 last:border-b-0 md:grid-cols-[11rem_1fr] md:gap-4">
      <dt className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm text-foreground">
        {value || fallback}
      </dd>
    </div>
  );
}

function PlatformStatusContent() {
  const t = useTranslations("platform");
  const apiBaseUrl = env.NEXT_PUBLIC_API_BASE_URL;
  const apiOrigin = apiOriginFromBaseUrl(apiBaseUrl);
  const apiSafety = getApiBaseUrlSafety(apiBaseUrl);
  const systemInfoQuery = useQuery({
    queryKey: platformQueryKeys.systemInfo(),
    queryFn: getSystemInfo,
    retry: 1,
    staleTime: 30_000,
  });

  return (
    <div className="grid gap-5">
      <section className="grid gap-4 lg:grid-cols-2">
        <Card variant="quiet">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
                <Server className="size-5" aria-hidden="true" />
              </div>
              <Badge
                variant={
                  apiSafety.status === "permanent" ? "success" : "warning"
                }
              >
                {apiSafety.status}
              </Badge>
            </div>
            <CardTitle>{t("status.webApiTargetTitle")}</CardTitle>
            <CardDescription>{apiSafety.reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <DetailRow
                label={t("status.baseUrl")}
                value={apiBaseUrl}
                fallback={t("status.notReported")}
              />
              <DetailRow
                label={t("status.host")}
                value={apiSafety.host}
                fallback={t("status.notReported")}
              />
              <DetailRow
                label={t("status.webAppEnv")}
                value={env.NEXT_PUBLIC_APP_ENV}
                fallback={t("status.notReported")}
              />
            </dl>
          </CardContent>
          <CardFooter>
            <a
              href={`${apiOrigin}/health`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              {t("status.health")}
            </a>
            <a
              href={`${apiBaseUrl.replace(/\/$/, "")}/system/info`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              {t("status.systemInfo")}
            </a>
          </CardFooter>
        </Card>

        <Card variant="quiet">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-11 items-center justify-center rounded-button bg-primary/15 text-primary">
                {systemInfoQuery.isError ? (
                  <AlertTriangle className="size-5" aria-hidden="true" />
                ) : (
                  <Activity className="size-5" aria-hidden="true" />
                )}
              </div>
              <Badge
                variant={
                  systemInfoQuery.isError
                    ? "danger"
                    : systemInfoQuery.data
                      ? "success"
                      : "muted"
                }
              >
                {systemInfoQuery.isError
                  ? t("status.unreachable")
                  : systemInfoQuery.data
                    ? t("status.online")
                    : t("status.checking")}
              </Badge>
            </div>
            <CardTitle>{t("status.apiMetadataTitle")}</CardTitle>
            <CardDescription>
              {systemInfoQuery.data?.timestamp ?? t("status.waitingForApi")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {systemInfoQuery.isPending ? (
              <LoadingState label={t("status.checkingApiMetadata")} />
            ) : null}

            {systemInfoQuery.isError ? (
              <EmptyState
                title={t("errors.apiMetadataLoadTitle")}
                description={formatErrorMessage(systemInfoQuery.error)}
                action={
                  <Button
                    onClick={() => void systemInfoQuery.refetch()}
                    variant="secondary"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    {t("actions.retry")}
                  </Button>
                }
              />
            ) : null}

            {systemInfoQuery.data ? (
              <dl>
                <DetailRow
                  label={t("status.service")}
                  value={systemInfoQuery.data.name}
                  fallback={t("status.notReported")}
                />
                <DetailRow
                  label={t("status.version")}
                  value={systemInfoQuery.data.version}
                  fallback={t("status.notReported")}
                />
                <DetailRow
                  label={t("status.appEnv")}
                  value={
                    systemInfoQuery.data.appEnvironment ??
                    systemInfoQuery.data.environment
                  }
                  fallback={t("status.notReported")}
                />
                <DetailRow
                  label={t("status.nodeEnv")}
                  value={systemInfoQuery.data.nodeEnvironment}
                  fallback={t("status.notReported")}
                />
                <DetailRow
                  label={t("status.apiPrefix")}
                  value={systemInfoQuery.data.apiPrefix}
                  fallback={t("status.notReported")}
                />
              </dl>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {apiSafety.status === "temporary" ? (
        <EmptyState
          title={t("status.temporaryApiTitle")}
          description={t("status.temporaryApiDescription")}
          action={
            <Link
              href="/platform"
              className={buttonVariants({ variant: "secondary" })}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              {t("actions.backToPlatform")}
            </Link>
          }
        />
      ) : null}
    </div>
  );
}

export function PlatformStatusPage() {
  const t = useTranslations("platform");

  return (
    <PlatformShell
      title={t("status.title")}
      description={t("status.description")}
      actions={
        <Button
          onClick={() => window.location.reload()}
          variant="secondary"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          {t("actions.refresh")}
        </Button>
      }
    >
      <PlatformAuthGate>
        <PlatformStatusContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
