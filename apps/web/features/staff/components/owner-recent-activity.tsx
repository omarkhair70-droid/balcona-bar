"use client";

import { AlertTriangle, Clock3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  formatDateTime,
  getRecordString,
  humanizeStatus,
  shortId
} from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";

type OwnerRecentActivityProps = {
  events: Record<string, unknown>[];
  isLoading?: boolean;
  error?: Error;
};

export function OwnerRecentActivity({
  events,
  isLoading,
  error
}: OwnerRecentActivityProps) {
  const t = useTranslations("owner");

  return (
    <Card variant="quiet">
      <CardHeader>
        <CardTitle>{t("activity.title")}</CardTitle>
        <CardDescription>
          {t("activity.description")}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? <LoadingState label={t("activity.loading")} /> : null}
        {error ? (
          <div className="rounded-card border border-warning bg-warning/10 p-3 text-sm text-warning">
            <AlertTriangle className="me-2 inline size-4" aria-hidden="true" />
            {error.message}
          </div>
        ) : null}
        {!isLoading && !error && events.length === 0 ? (
          <EmptyState
            title={t("empty.recentActivityTitle")}
            description={t("empty.recentActivityDescription")}
          />
        ) : null}
        {!isLoading && !error
          ? events.map((event, index) => (
              <article
                key={getRecordString(event, "id") || String(index)}
                className="rounded-card border bg-surface/75 p-3"
              >
                <p className="text-sm font-semibold text-foreground">
                  {humanizeStatus(getRecordString(event, "type", "event"))}
                </p>
                <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  {getRecordString(event, "channel", "system")} /{" "}
                  {formatDateTime(getRecordString(event, "createdAt"))}
                </p>
                {getRecordString(event, "orderId") ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("activity.orderId", {
                      id: shortId(getRecordString(event, "orderId"))
                    })}
                  </p>
                ) : null}
                {getRecordString(event, "waiterCallId") ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("activity.callId", {
                      id: shortId(getRecordString(event, "waiterCallId"))
                    })}
                  </p>
                ) : null}
                {getRecordString(event, "tableSessionId") ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("activity.sessionId", {
                      id: shortId(getRecordString(event, "tableSessionId"))
                    })}
                  </p>
                ) : null}
              </article>
            ))
          : null}
      </CardContent>
    </Card>
  );
}
