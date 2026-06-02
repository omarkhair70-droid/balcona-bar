"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { BellRing, Droplets, HelpCircle, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import {
  createWaiterCall,
  getBill,
  getWaiterCalls,
  requestBill
} from "@/lib/api/endpoints";
import { customerQueryKeys } from "@/lib/api/query-keys";
import type { WaiterCallPayload } from "@/lib/api/types";
import { useCustomerSessionStore } from "@/lib/customer/customer-session-store";
import { vibrateSuccess, vibrateWarning } from "@/lib/haptics/haptics";
import { CustomerSessionScreen } from "../customer-session-screen";
import { ServiceActionCard } from "../service-action-card";

type CustomerServicePageProps = {
  sessionId: string;
};

const serviceActions: Array<{
  title: string;
  description: string;
  actionLabel: string;
  payload: WaiterCallPayload;
  icon: ReactNode;
}> = [
  {
    title: "Call waiter",
    description: "Let the team know you need service at the table.",
    actionLabel: "Call",
    payload: { type: "call_waiter", priority: 2 },
    icon: <BellRing className="size-6" aria-hidden="true" />
  },
  {
    title: "Water",
    description: "Ask for water without leaving the table experience.",
    actionLabel: "Request water",
    payload: { type: "need_water", priority: 1 },
    icon: <Droplets className="size-6" aria-hidden="true" />
  },
  {
    title: "Need help",
    description: "For questions, special requests, or order help.",
    actionLabel: "Ask for help",
    payload: { type: "need_help", priority: 2 },
    icon: <HelpCircle className="size-6" aria-hidden="true" />
  }
];

function getRecords(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null
    );
  }

  return [];
}

export function CustomerServicePage({ sessionId }: CustomerServicePageProps) {
  const queryClient = useQueryClient();
  const token = useCustomerSessionStore((state) => state.customerAccessToken);
  const waiterCallsQuery = useQuery({
    queryKey: customerQueryKeys.waiterCalls(sessionId),
    queryFn: () => getWaiterCalls(sessionId, token),
    staleTime: 10_000
  });
  const billQuery = useQuery({
    queryKey: customerQueryKeys.bill(sessionId),
    queryFn: () => getBill(sessionId, token),
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
  const billMutation = useMutation({
    mutationFn: () => requestBill(sessionId, {}, token),
    onSuccess: () => {
      vibrateSuccess();
      void queryClient.invalidateQueries({
        queryKey: customerQueryKeys.bill(sessionId)
      });
    },
    onError: () => vibrateWarning()
  });
  const waiterCalls = getRecords(
    waiterCallsQuery.data?.waiterCalls ?? waiterCallsQuery.data?.calls
  );

  return (
    <CustomerSessionScreen
      sessionId={sessionId}
      active="service"
      eyebrow="Service"
      title="Ask the team without leaving your table"
      description="Call a waiter, ask for help, request water, or ask for the bill. The UI keeps active requests visible to prevent noisy repeats."
    >
      <section className="grid gap-4 md:grid-cols-3">
        {serviceActions.map((action) => (
          <ServiceActionCard
            key={action.title}
            title={action.title}
            description={action.description}
            actionLabel={action.actionLabel}
            icon={action.icon}
            pending={
              callMutation.isPending &&
              callMutation.variables?.type === action.payload.type
            }
            onAction={() => callMutation.mutate(action.payload)}
          />
        ))}
      </section>

      <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card variant="glass" padding="lg">
          <CardHeader>
            <CardTitle>Recent service calls</CardTitle>
            <CardDescription>
              Latest table requests returned by the backend.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {waiterCallsQuery.isPending ? <LoadingState label="Loading calls" /> : null}
            {waiterCallsQuery.isError ? (
              <EmptyState
                title="Service calls could not load"
                description={waiterCallsQuery.error.message}
              />
            ) : null}
            {waiterCalls.length === 0 && waiterCallsQuery.isSuccess ? (
              <EmptyState
                title="No active calls"
                description="The team has no pending request from this table."
              />
            ) : null}
            {waiterCalls.slice(0, 5).map((call, index) => (
              <div key={`${String(call.id ?? index)}`} className="rounded-card border bg-surface/75 p-4">
                <p className="text-sm font-semibold text-foreground">
                  {String(call.type ?? "Service request")}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {String(call.status ?? "open")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card variant="glass" padding="lg">
          <CardHeader>
            <div className="text-primary">
              <ReceiptText className="size-6" aria-hidden="true" />
            </div>
            <CardTitle>Bill request</CardTitle>
            <CardDescription>
              Ask for the bill when your table is ready. Existing bill state is
              shown when the backend returns it.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {billQuery.isPending ? <LoadingState label="Loading bill" /> : null}
            {billQuery.isError ? (
              <EmptyState title="Bill could not load" description={billQuery.error.message} />
            ) : null}
            <div className="rounded-card border bg-surface/75 p-4">
              <p className="text-sm font-semibold text-foreground">
                Current bill state
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                {billQuery.data
                  ? "Bill information loaded from backend."
                  : "No bill request is active yet."}
              </p>
              <Button
                className="mt-4"
                onClick={() => billMutation.mutate()}
                disabled={billMutation.isPending}
              >
                {billMutation.isPending ? "Requesting..." : "Request bill"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </CustomerSessionScreen>
  );
}
