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

export type OwnerLocalizedText = {
  key: string;
  values?: Record<string, string | number>;
};

export type OwnerHealthSummary = {
  level: OwnerHealthLevel;
  labelKey: string;
  descriptionKey: string;
  reasons: OwnerLocalizedText[];
  recommendedActions: OwnerLocalizedText[];
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
  const reasons: OwnerLocalizedText[] = [];
  const recommendedActions: OwnerLocalizedText[] = [];

  if (input.urgentAttention > 0) {
    reasons.push({
      key: "health.reasons.urgentAttention",
      values: { count: input.urgentAttention }
    });
    recommendedActions.push({ key: "health.actions.openWaiterDashboard" });
  }

  if (input.urgentWaiterCalls > 0) {
    reasons.push({
      key: "health.reasons.urgentWaiterCalls",
      values: { count: input.urgentWaiterCalls }
    });
    recommendedActions.push({ key: "health.actions.assignFloorStaff" });
  }

  if (input.submittedOrders > 0) {
    reasons.push({
      key: "health.reasons.submittedOrders",
      values: { count: input.submittedOrders }
    });
    recommendedActions.push({ key: "health.actions.reviewCashierIntake" });
  }

  if (input.readyOrders > 0) {
    reasons.push({
      key: "health.reasons.readyOrders",
      values: { count: input.readyOrders }
    });
    recommendedActions.push({ key: "health.actions.serveReadyOrders" });
  }

  if (input.pendingTasks + input.preparingTasks >= 6) {
    reasons.push({ key: "health.reasons.preparationLoad" });
    recommendedActions.push({ key: "health.actions.checkKitchenBarista" });
  }

  if (input.openBillRequests > 0) {
    reasons.push({
      key: "health.reasons.openBillRequests",
      values: { count: input.openBillRequests }
    });
    recommendedActions.push({ key: "health.actions.reviewBillRequests" });
  }

  if (
    input.urgentAttention >= 3 ||
    input.urgentWaiterCalls >= 3 ||
    (input.urgentAttention > 0 && input.submittedOrders >= 3)
  ) {
    return {
      level: "critical",
      labelKey: "health.levels.critical",
      descriptionKey: "health.descriptions.critical",
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
      labelKey: "health.levels.needsManagerAttention",
      descriptionKey: "health.descriptions.needsManagerAttention",
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
      labelKey: "health.levels.busy",
      descriptionKey: "health.descriptions.busy",
      reasons:
        reasons.length > 0
          ? reasons
          : [{ key: "health.reasons.branchActivityElevated" }],
      recommendedActions:
        recommendedActions.length > 0
          ? recommendedActions
          : [{ key: "health.actions.keepScanning" }]
    };
  }

  return {
    level: "calm",
    labelKey: "health.levels.calm",
    descriptionKey: "health.descriptions.calm",
    reasons: [{ key: "health.reasons.noUrgentPressure" }],
    recommendedActions: [{ key: "health.actions.keepPulseOpen" }]
  };
}
