"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Droplets, HelpCircle, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { createWaiterCall, getWaiterCalls } from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import type { WaiterCallPayload } from "@/lib/api/types";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { vibrateSuccess, vibrateWarning } from "@/lib/haptics/haptics";
import { useTranslations } from "@/lib/i18n/i18n-provider";
import { CustomerSessionScreen } from "../customer-session-screen";
import { ServiceActionCard } from "../service-action-card";

type CustomerServicePageProps = {
  sessionId: string;
};

const serviceActions: Array<{
  titleKey: string;
  descriptionKey: string;
  payload: WaiterCallPayload;
  icon: typeof BellRing;
}> = [
  {
    titleKey: "service.callTitle",
    descriptionKey: "service.callDescription",
    payload: { type: "call_waiter", priority: 2 },
    icon: BellRing
  },
  {
    titleKey: "service.waterTitle",
    descriptionKey: "service.waterDescription",
    payload: { type: "need_water", priority: 1 },
    icon: Droplets
  },
  {
    titleKey: "service.helpTitle",
    descriptionKey: "service.helpDescription",
    payload: { type: "need_help", priority: 2 },
    icon: HelpCircle
  }
];

function records(value: unknown) {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
    : [];
}

function recordString(record: Record<string, unknown>, key: string) {
  return typeof record[key] === "string" ? record[key] : "";
}

function requestIsActive(call: Record<string, unknown>) {
  return !["resolved", "cancelled", "closed", "completed"].includes(
    recordString(call, "status").toLowerCase()
  );
}

export function CustomerServicePage({ sessionId }: CustomerServicePageProps) {
  const t = useTranslations("customer");
  const router = useRouter();
  const queryClient = useQueryClient();
  const token = useCustomerSessionStore((state) => state.customerAccessToken);

  useEffect(() => {
    if (window.location.hash === "#bill") {
      router.replace(`/customer/session/${sessionId}/bill`);
    }
  }, [router, sessionId]);

  const waiterCallsQuery = useQuery({
    queryKey: customerQueryKeys.waiterCalls(sessionId),
    queryFn: () => getWaiterCalls(sessionId, token),
    enabled: Boolean(token),
    staleTime: 10_000
  });

  const callMutation = useMutation({
    mutationFn: (payload: WaiterCallPayload) =>
      createWaiterCall(sessionId, payload, token),
    onSuccess: () => {
      vibrateSuccess();
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.waiterCalls(sessionId)
      });
    },
    onError: () => vibrateWarning()
  });

  const waiterCalls = records(
    waiterCallsQuery.data?.waiterCalls ?? waiterCallsQuery.data?.calls
  );
  const activeTypes = new Set(
    waiterCalls
      .filter(requestIsActive)
      .map((call) => recordString(call, "type"))
      .filter(Boolean)
  );

  function typeLabel(type: string) {
    if (type === "call_waiter") return t("service.callTitle");
    if (type === "need_water") return t("service.waterTitle");
    if (type === "need_help") return t("service.helpTitle");
    if (type === "need_bill") return t("bill.title");
    return t("service.requestFallback");
  }

  function statusLabel(status: string) {
    if (["acknowledged", "accepted"].includes(status)) {
      return t("service.teamOnWay");
    }
    if (["resolved", "closed", "completed"].includes(status)) {
      return t("service.requestDone");
    }
    return t("service.teamNotified");
  }

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="service"
      eyebrow={t("service.eyebrow")}
      title={t("service.title")}
      description={t("service.description")}
    >
      <section className="grid gap-3">
        {serviceActions.map((action) => {
          const Icon = action.icon;
          const isActive = activeTypes.has(action.payload.type);
          return (
            <ServiceActionCard
              key={action.titleKey}
              title={t(action.titleKey)}
              description={
                isActive
                  ? t("service.requestAlreadyActive")
                  : t(action.descriptionKey)
              }
              actionLabel={t(action.titleKey)}
              icon={<Icon className="size-6" aria-hidden="true" />}
              pending={
                callMutation.isPending &&
                callMutation.variables?.type === action.payload.type
              }
              disabled={isActive}
              onAction={() => callMutation.mutate(action.payload)}
            />
          );
        })}

        <Link
          href={`/customer/session/${sessionId}/ai-waiter`}
          className="flex min-h-20 items-center gap-4 rounded-[22px] border border-border bg-muted p-4 text-start"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-black text-foreground">
              {t("service.aiHelpTitle")}
            </span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              {t("service.aiHelpDescription")}
            </span>
          </span>
          <span className={buttonVariants({ variant: "secondary", size: "sm" })}>
            {t("actions.open")}
          </span>
        </Link>
      </section>

      {callMutation.isError ? (
        <div role="alert" className="mt-4 rounded-xl border border-danger/35 bg-danger/10 p-3 text-sm text-danger">
          {t("errors.serviceRequestSimple")}
        </div>
      ) : null}

      <section className="mt-5 pb-8">
        <h2 className="text-sm font-black text-foreground">
          {t("service.recentCallsTitle")}
        </h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {t("service.recentCallsDescription")}
        </p>

        {waiterCallsQuery.isPending ? (
          <div className="mt-3">
            <LoadingState label={t("service.loadingCalls")} />
          </div>
        ) : null}

        {waiterCallsQuery.isError ? (
          <div className="mt-3">
            <EmptyState
              title={t("errors.serviceCallsLoad")}
              description={t("errors.tryAgain")}
            />
          </div>
        ) : null}

        {waiterCallsQuery.isSuccess && waiterCalls.length === 0 ? (
          <div className="mt-3 rounded-[20px] border border-border bg-card p-4 text-sm text-muted-foreground">
            {t("empty.serviceCallsDescription")}
          </div>
        ) : null}

        {waiterCalls.length > 0 ? (
          <div className="mt-3 divide-y divide-border rounded-[22px] border border-border bg-card px-4">
            {waiterCalls.slice(0, 5).map((call, index) => {
              const type = recordString(call, "type");
              const status = recordString(call, "status").toLowerCase();
              return (
                <div key={String(call.id ?? index)} className="flex items-center justify-between gap-3 py-3">
                  <p className="text-sm font-black text-foreground">
                    {typeLabel(type)}
                  </p>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {statusLabel(status)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </section>
    </CustomerSessionScreen>
  );
}
