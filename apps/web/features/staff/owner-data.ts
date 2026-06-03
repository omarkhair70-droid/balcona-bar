import {
  getAttentionPriority,
  getAttentionScore,
  getAttentionStatus
} from "./attention-data";
import {
  getBillRequestStatus,
  getCurrency,
  getMinorTotal,
  getOrderRecord,
  getOrderStatus,
  getOrderTotals
} from "./cashier-data";
import { getTaskStation, getTaskStatus } from "./preparation-data";
import { formatMoney, getRecordNumber, getRecordString } from "./staff-format";
import {
  getWaiterCallPriority,
  getWaiterCallStatus
} from "./waiter-data";

export type OwnerHealthLevel =
  | "calm"
  | "busy"
  | "needs_manager_attention"
  | "critical";

export type OwnerHealthSummary = {
  level: OwnerHealthLevel;
  label: string;
  description: string;
  reasons: string[];
  recommendedActions: string[];
};

export type OwnerHealthInput = {
  activeOrders: number;
  submittedOrders: number;
  readyOrders: number;
  pendingTasks: number;
  preparingTasks: number;
  openWaiterCalls: number;
  urgentWaiterCalls: number;
  openBillRequests: number;
  urgentAttention: number;
  needsAttention: number;
};

export function safeCountByStatus(
  records: Record<string, unknown>[],
  getStatus: (record: Record<string, unknown>) => string,
  status: string
) {
  return records.filter((record) => getStatus(record) === status).length;
}

export function getOwnerOrderStatus(record: Record<string, unknown>) {
  return getOrderStatus(record);
}

export function getOwnerOrderValueMinor(record: Record<string, unknown>) {
  const totals = getOrderTotals(record);
  const order = getOrderRecord(record);

  return (
    getMinorTotal(totals) ||
    getRecordNumber(totals, "totalMinor") ||
    getRecordNumber(totals, "grandTotalMinor") ||
    getRecordNumber(order, "subtotalMinor") ||
    getRecordNumber(order, "totalMinor")
  );
}

export function getOwnerOrderCurrency(record: Record<string, unknown>) {
  return (
    getCurrency(getOrderTotals(record)) ||
    getRecordString(getOrderRecord(record), "currency", "EGP")
  );
}

export function getOwnerBillStatus(record: Record<string, unknown>) {
  return getBillRequestStatus(record);
}

export function getOwnerTaskStatus(record: Record<string, unknown>) {
  return getTaskStatus(record);
}

export function getOwnerTaskStation(record: Record<string, unknown>) {
  return getTaskStation(record);
}

export function getOwnerWaiterCallStatus(record: Record<string, unknown>) {
  return getWaiterCallStatus(record);
}

export function getOwnerWaiterCallPriority(record: Record<string, unknown>) {
  return getWaiterCallPriority(record);
}

export function getOwnerAttentionStatus(record: Record<string, unknown>) {
  return getAttentionStatus(record);
}

export function getOwnerAttentionPriority(record: Record<string, unknown>) {
  return getAttentionPriority(record);
}

export function getOwnerAttentionScore(record: Record<string, unknown>) {
  return getAttentionScore(record);
}

export function formatVisibleValue(
  minor: number,
  currency = "EGP",
  hasValue = true
) {
  return hasValue ? formatMoney(minor, currency) : "Not returned";
}

export function buildOwnerHealthSummary(
  input: OwnerHealthInput
): OwnerHealthSummary {
  const reasons: string[] = [];
  const recommendedActions: string[] = [];

  if (input.urgentAttention > 0) {
    reasons.push(`${input.urgentAttention} urgent attention signal(s)`);
    recommendedActions.push("Open waiter dashboard and recover the table");
  }

  if (input.urgentWaiterCalls > 0) {
    reasons.push(`${input.urgentWaiterCalls} high-priority waiter call(s)`);
    recommendedActions.push("Assign floor staff to open calls");
  }

  if (input.submittedOrders > 0) {
    reasons.push(`${input.submittedOrders} submitted order(s) awaiting cashier`);
    recommendedActions.push("Review cashier intake");
  }

  if (input.readyOrders > 0) {
    reasons.push(`${input.readyOrders} ready order(s) may need serving`);
    recommendedActions.push("Send waiter to serve ready orders");
  }

  if (input.pendingTasks + input.preparingTasks >= 6) {
    reasons.push("Preparation load is building");
    recommendedActions.push("Check kitchen and barista lanes");
  }

  if (input.openBillRequests > 0) {
    reasons.push(`${input.openBillRequests} bill request(s) need follow-up`);
    recommendedActions.push("Review cashier bill requests");
  }

  if (
    input.urgentAttention >= 3 ||
    input.urgentWaiterCalls >= 3 ||
    (input.urgentAttention > 0 && input.submittedOrders >= 3)
  ) {
    return {
      level: "critical",
      label: "Critical",
      description: "Multiple urgent signals need manager intervention.",
      reasons,
      recommendedActions
    };
  }

  if (
    input.urgentAttention > 0 ||
    input.urgentWaiterCalls > 0 ||
    input.submittedOrders >= 3 ||
    input.openWaiterCalls >= 4 ||
    input.readyOrders >= 2 ||
    input.openBillRequests >= 3
  ) {
    return {
      level: "needs_manager_attention",
      label: "Needs manager attention",
      description: "The branch has signals that should be actively managed.",
      reasons,
      recommendedActions
    };
  }

  if (
    input.activeOrders >= 3 ||
    input.pendingTasks + input.preparingTasks >= 4 ||
    input.openWaiterCalls > 0 ||
    input.needsAttention > 0 ||
    input.openBillRequests > 0
  ) {
    return {
      level: "busy",
      label: "Busy",
      description: "Operations are moving, but no critical pattern is visible.",
      reasons: reasons.length > 0 ? reasons : ["Branch activity is elevated"],
      recommendedActions:
        recommendedActions.length > 0
          ? recommendedActions
          : ["Keep scanning active lanes"]
    };
  }

  return {
    level: "calm",
    label: "Calm",
    description: "No active bottleneck is visible from the returned endpoints.",
    reasons: ["No urgent attention, open calls, or order intake pressure"],
    recommendedActions: ["Keep the branch pulse open for realtime changes"]
  };
}
