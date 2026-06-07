"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  Server,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PlatformAuthGate } from "@/features/platform/components/platform-auth-gate";
import { PlatformShell } from "@/features/platform/platform-shell";
import { formatErrorMessage } from "@/lib/api/error-message";
import { getSystemInfo } from "@/lib/api/endpoints";
import { platformQueryKeys } from "@/lib/api/query-keys";
import { env, getApiBaseUrlSafety } from "@/lib/config/env";

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
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="grid gap-1 border-b border-border/70 py-3 last:border-b-0 md:grid-cols-[11rem_1fr] md:gap-4">
      <dt className="text-xs font-semibold uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="break-words text-sm text-foreground">
        {value || "Not reported"}
      </dd>
    </div>
  );
}

function PlatformStatusContent() {
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
            <CardTitle>Web API target</CardTitle>
            <CardDescription>{apiSafety.reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <dl>
              <DetailRow label="Base URL" value={apiBaseUrl} />
              <DetailRow label="Host" value={apiSafety.host} />
              <DetailRow
                label="Web app env"
                value={env.NEXT_PUBLIC_APP_ENV}
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
              Health
            </a>
            <a
              href={`${apiBaseUrl.replace(/\/$/, "")}/system/info`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <ExternalLink className="size-4" aria-hidden="true" />
              System info
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
                  ? "unreachable"
                  : systemInfoQuery.data
                    ? "online"
                    : "checking"}
              </Badge>
            </div>
            <CardTitle>Railway API metadata</CardTitle>
            <CardDescription>
              {systemInfoQuery.data?.timestamp ?? "Waiting for API response"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {systemInfoQuery.isPending ? (
              <LoadingState label="Checking API metadata" />
            ) : null}

            {systemInfoQuery.isError ? (
              <EmptyState
                title="API metadata could not be loaded"
                description={formatErrorMessage(systemInfoQuery.error)}
                action={
                  <Button
                    onClick={() => void systemInfoQuery.refetch()}
                    variant="secondary"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    Retry
                  </Button>
                }
              />
            ) : null}

            {systemInfoQuery.data ? (
              <dl>
                <DetailRow label="Service" value={systemInfoQuery.data.name} />
                <DetailRow
                  label="Version"
                  value={systemInfoQuery.data.version}
                />
                <DetailRow
                  label="APP_ENV"
                  value={
                    systemInfoQuery.data.appEnvironment ??
                    systemInfoQuery.data.environment
                  }
                />
                <DetailRow
                  label="NODE_ENV"
                  value={systemInfoQuery.data.nodeEnvironment}
                />
                <DetailRow
                  label="API prefix"
                  value={systemInfoQuery.data.apiPrefix}
                />
              </dl>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {apiSafety.status === "temporary" ? (
        <EmptyState
          title="Temporary API URL configured"
          description="Staging Vercel must point to the permanent Railway API URL before client demos."
          action={
            <Link
              href="/platform"
              className={buttonVariants({ variant: "secondary" })}
            >
              <CheckCircle2 className="size-4" aria-hidden="true" />
              Back to platform
            </Link>
          }
        />
      ) : null}
    </div>
  );
}

export function PlatformStatusPage() {
  return (
    <PlatformShell
      title="Staging status"
      description="Permanent staging runtime checks for the Vercel web app and Railway API."
      actions={
        <Button
          onClick={() => window.location.reload()}
          variant="secondary"
        >
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      }
    >
      <PlatformAuthGate>
        <PlatformStatusContent />
      </PlatformAuthGate>
    </PlatformShell>
  );
}
