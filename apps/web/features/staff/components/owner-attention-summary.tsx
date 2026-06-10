"use client";

import Link from "next/link";
import { AlertTriangle, Gauge } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
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
  getAttentionActionLabel,
  getAttentionFloor,
  getAttentionPriority,
  getAttentionReasonMessage,
  getAttentionReasons,
  getAttentionRecommendedActions,
  getAttentionScore,
  getAttentionStatus,
  getAttentionTable
} from "@/features/staff/attention-data";
import {
  getTableLabel,
  humanizeStatus
} from "@/features/staff/staff-format";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { AttentionPriorityPill } from "./attention-priority-pill";
import { AttentionStatusPill } from "./attention-status-pill";

type OwnerAttentionSummaryProps = {
  attentionItems: Record<string, unknown>[];
  isLoading?: boolean;
  error?: Error;
};

export function OwnerAttentionSummary({
  attentionItems,
  isLoading,
  error
}: OwnerAttentionSummaryProps) {
  const t = useTranslations("owner");
  const topItems = attentionItems
    .slice()
    .sort((first, second) => getAttentionScore(second) - getAttentionScore(first))
    .slice(0, 5);

  return (
    <Card variant="glass" padding="lg">
      <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <Badge variant="muted" className="mb-3">
            {t("attention.serviceRecoveryBadge")}
          </Badge>
          <CardTitle>{t("attention.title")}</CardTitle>
          <CardDescription>
            {t("attention.description")}
          </CardDescription>
        </div>
        <Link href="/staff/waiter" className={buttonVariants({ variant: "secondary" })}>
          <AlertTriangle className="size-4" aria-hidden="true" />
          {t("actions.openWaiter")}
        </Link>
      </CardHeader>
      <CardContent className="grid gap-3">
        {isLoading ? <LoadingState label={t("attention.loading")} /> : null}
        {error ? (
          <EmptyState
            title={t("errors.attentionSummaryLoadTitle")}
            description={error.message}
          />
        ) : null}
        {!isLoading && !error && topItems.length === 0 ? (
          <EmptyState
            title={t("empty.attentionRisksTitle")}
            description={t("empty.attentionRisksDescription")}
          />
        ) : null}
        {!isLoading && !error
          ? topItems.map((item, index) => {
              const reasons = getAttentionReasons(item);
              const actions = getAttentionRecommendedActions(item);

              return (
                <article
                  key={`${getTableLabel(getAttentionTable(item), getAttentionFloor(item))}-${index}`}
                  className="rounded-card border bg-surface/75 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {getTableLabel(
                          getAttentionTable(item),
                          getAttentionFloor(item)
                        )}
                      </p>
                      <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Gauge className="size-3.5" aria-hidden="true" />
                        {t("attention.score", {
                          count: getAttentionScore(item)
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <AttentionStatusPill status={getAttentionStatus(item)} />
                      <AttentionPriorityPill
                        priority={getAttentionPriority(item)}
                      />
                    </div>
                  </div>
                  {reasons[0] ? (
                    <p className="mt-3 rounded-card border border-warning/40 bg-warning/10 p-2 text-xs text-warning">
                      {getAttentionReasonMessage(reasons[0])}
                    </p>
                  ) : null}
                  {actions.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {actions.slice(0, 3).map((action, actionIndex) => (
                        <Badge
                          key={`${getAttentionActionLabel(action)}-${actionIndex}`}
                          variant="muted"
                        >
                          {humanizeStatus(getAttentionActionLabel(action))}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })
          : null}
      </CardContent>
    </Card>
  );
}
