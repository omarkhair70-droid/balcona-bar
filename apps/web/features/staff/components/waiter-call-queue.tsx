"use client";

import { RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingState } from "@/components/ui/loading-state";
import { getWaiterCallId } from "@/features/staff/waiter-data";
import type { WaiterCallStatus, WaiterCallType } from "@/lib/api/types";
import { useTranslations } from "@/lib/i18n/i18n-provider";
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
  onPrefetchWaiterCall?: (waiterCallId: string) => void;
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
  onPrefetchWaiterCall,
  onRefresh
}: WaiterCallQueueProps) {
  const t = useTranslations("staff");

  return (
    <section className="min-h-[34rem] min-w-0 border border-[#3B3028] bg-[#17120F]">
      <div className="border-b border-[#342A23] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[#FFF5E8]">
              {t("waiter.callsTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[#95887D]">
              {t("waiter.callsDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="flex size-9 shrink-0 items-center justify-center rounded-md border border-[#3C3129] bg-[#211A15] text-[#AFA195] transition hover:border-[#5A483A] hover:text-[#F6EBDD]"
            aria-label={t("actions.refresh")}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-3">
          <WaiterCallTypeFilter
            status={status}
            type={type}
            onStatusChange={onStatusChange}
            onTypeChange={onTypeChange}
          />
        </div>
      </div>

      <div className="p-3">
        {isLoading ? <LoadingState label={t("waiter.loadingCalls")} /> : null}
        {error ? (
          <EmptyState
            title={t("waiter.callsLoadError")}
            description={error.message}
          />
        ) : null}
        {!isLoading && !error && waiterCalls.length === 0 ? (
          <EmptyState
            title={t("waiter.callsEmptyTitle")}
            description={t("waiter.callsEmptyDescription")}
          />
        ) : null}
        {!isLoading && !error && waiterCalls.length > 0 ? (
          <div className="grid gap-2">
            {waiterCalls.map((waiterCall, index) => {
              const waiterCallId = getWaiterCallId(waiterCall) || String(index);

              return (
                <WaiterCallCard
                  key={waiterCallId}
                  waiterCall={waiterCall}
                  selected={selectedWaiterCallId === waiterCallId}
                  onSelect={onSelectWaiterCall}
                  onPrefetch={onPrefetchWaiterCall}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
