"use client";

import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { getWaiterCallId } from "@/features/staff/waiter-data";
import type { WaiterCallStatus, WaiterCallType } from "@/lib/api/types";
import { WaiterCallCard } from "./waiter-call-card";
import { WaiterCallTypeFilter } from "./waiter-call-type-filter";

type WaiterCallQueueProps = {
  waiterCalls: Record<string, unknown>[];
  status: WaiterCallStatus;
  type: WaiterCallType;
  selectedWaiterCallId?: string;
  isLoading?: boolean;
  error?: Error;
  onStatusChange: (status: WaiterCallStatus) => void;
  onTypeChange: (type: WaiterCallType) => void;
  onSelectWaiterCall: (waiterCallId: string) => void;
  onRefresh: () => void;
};

export function WaiterCallQueue({
  waiterCalls,
  status,
  type,
  selectedWaiterCallId,
  isLoading,
  error,
  onStatusChange,
  onTypeChange,
  onSelectWaiterCall,
  onRefresh
}: WaiterCallQueueProps) {
  return (
    <Card variant="glass" padding="lg" className="min-h-[34rem]">
      <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Waiter calls</CardTitle>
          <CardDescription>
            Customer service requests owned by the branch waiter-call workflow.
          </CardDescription>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <WaiterCallTypeFilter
            status={status}
            type={type}
            onStatusChange={onStatusChange}
            onTypeChange={onTypeChange}
          />
        </div>

        {isLoading ? <LoadingState label="Loading waiter calls" /> : null}
        {error ? (
          <EmptyState
            title="Waiter calls could not load"
            description={error.message}
          />
        ) : null}
        {!isLoading && !error && waiterCalls.length === 0 ? (
          <EmptyState
            title="No waiter calls in this lane"
            description="Customer requests, bill help, and service issues will appear here when tables ask for staff."
          />
        ) : null}
        {!isLoading && !error && waiterCalls.length > 0 ? (
          <div className="grid gap-3">
            {waiterCalls.map((waiterCall, index) => {
              const waiterCallId = getWaiterCallId(waiterCall) || String(index);

              return (
                <WaiterCallCard
                  key={waiterCallId}
                  waiterCall={waiterCall}
                  selected={selectedWaiterCallId === waiterCallId}
                  onSelect={onSelectWaiterCall}
                />
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
