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
import { getAttentionSessionId } from "@/features/staff/attention-data";
import { humanizeStatus } from "@/features/staff/staff-format";
import { cn } from "@/lib/utils/cn";
import type { TableAttentionPriority, TableAttentionStatus } from "@/lib/api/types";
import { AttentionCard } from "./attention-card";

export type AttentionStatusFilter = "active" | TableAttentionStatus;

type AttentionQueueProps = {
  attentionQueue: Record<string, unknown>[];
  status: AttentionStatusFilter;
  priority: TableAttentionPriority;
  selectedSessionId?: string;
  isLoading?: boolean;
  error?: Error;
  onStatusChange: (status: AttentionStatusFilter) => void;
  onPriorityChange: (priority: TableAttentionPriority) => void;
  onSelectAttention: (sessionId: string) => void;
  onRefresh: () => void;
};

const statusOptions: AttentionStatusFilter[] = [
  "active",
  "urgent",
  "needs_attention",
  "muted",
  "resolved",
  "normal",
  "all"
];

const priorityOptions: TableAttentionPriority[] = [
  "all",
  "urgent",
  "high",
  "medium",
  "low"
];

function FilterButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-9 whitespace-nowrap rounded-button border px-3 text-xs font-semibold transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

export function AttentionQueue({
  attentionQueue,
  status,
  priority,
  selectedSessionId,
  isLoading,
  error,
  onStatusChange,
  onPriorityChange,
  onSelectAttention,
  onRefresh
}: AttentionQueueProps) {
  return (
    <Card variant="glass" padding="lg" className="min-h-[34rem]">
      <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between sm:space-y-0">
        <div>
          <CardTitle>Attention queue</CardTitle>
          <CardDescription>
            Autopilot table signals for service recovery and floor follow-up.
          </CardDescription>
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-4" aria-hidden="true" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid gap-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {statusOptions.map((option) => (
              <FilterButton
                key={option}
                active={status === option}
                label={option === "active" ? "Active" : humanizeStatus(option)}
                onClick={() => onStatusChange(option)}
              />
            ))}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {priorityOptions.map((option) => (
              <FilterButton
                key={option}
                active={priority === option}
                label={humanizeStatus(option)}
                onClick={() => onPriorityChange(option)}
              />
            ))}
          </div>
        </div>

        {isLoading ? <LoadingState label="Loading table attention" /> : null}
        {error ? (
          <EmptyState
            title="Attention queue could not load"
            description={error.message}
          />
        ) : null}
        {!isLoading && !error && attentionQueue.length === 0 ? (
          <EmptyState
            title="No tables need attention"
            description="Active waiter calls, bill requests, ready orders, delays, and AI escalations will appear here when the backend flags them."
          />
        ) : null}
        {!isLoading && !error && attentionQueue.length > 0 ? (
          <div className="grid gap-3">
            {attentionQueue.map((attention, index) => {
              const sessionId = getAttentionSessionId(attention) || String(index);

              return (
                <AttentionCard
                  key={sessionId}
                  attention={attention}
                  selected={selectedSessionId === sessionId}
                  onSelect={onSelectAttention}
                />
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
