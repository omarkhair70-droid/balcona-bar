import { OrderStatus, PreparationTaskStatus } from '@prisma/client';

export const ORDER_LIFECYCLE_ACTIONS = [
  'submit',
  'accept',
  'reject',
  'start_preparation',
  'system_preparation_started',
  'mark_preparation_ready',
  'system_preparation_ready',
  'serve',
  'complete',
  'cancel',
] as const;

export type OrderLifecycleAction = (typeof ORDER_LIFECYCLE_ACTIONS)[number];

export type OrderLifecycleDeniedReason =
  | 'order_not_found'
  | 'invalid_order_transition'
  | 'order_already_terminal'
  | 'order_not_submitted'
  | 'order_not_ready_to_serve'
  | 'order_has_pending_preparation_tasks'
  | 'order_not_served'
  | 'cancellation_requires_reason'
  | 'cancellation_not_allowed_from_status'
  | 'missing_staff_actor'
  | 'stale_order_state'
  | 'idempotency_conflict';

export type OrderLifecycleProgressStep =
  | 'cart_draft'
  | 'cashier_review'
  | 'accepted'
  | 'preparing'
  | 'ready_to_serve'
  | 'served'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type OrderLifecycleExpectedRole =
  | 'customer'
  | 'cashier'
  | 'kitchen'
  | 'barista'
  | 'waiter'
  | 'manager'
  | 'none';

export type OrderLifecycleTaskSnapshot = {
  status: PreparationTaskStatus;
};

export type OrderLifecycleOrderSnapshot = {
  status: OrderStatus;
  preparationTasks?: OrderLifecycleTaskSnapshot[];
};

const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.completed,
  OrderStatus.cashier_rejected,
  OrderStatus.cancelled,
]);

const CANCELLABLE_ORDER_STATUSES = new Set<OrderStatus>([
  OrderStatus.submitted,
  OrderStatus.cashier_accepted,
  OrderStatus.preparing,
]);

const STAFF_ACTIONS: OrderLifecycleAction[] = [
  'accept',
  'reject',
  'serve',
  'complete',
  'cancel',
];

const CUSTOMER_STATUS_COPY: Record<OrderStatus, string> = {
  [OrderStatus.submitted]: 'Sent to cashier',
  [OrderStatus.cashier_accepted]: 'Accepted',
  [OrderStatus.preparing]: 'Preparing',
  [OrderStatus.ready]: 'Ready',
  [OrderStatus.served]: 'Served',
  [OrderStatus.completed]: 'Completed',
  [OrderStatus.cashier_rejected]: 'Rejected',
  [OrderStatus.cancelled]: 'Cancelled',
};

export function isTerminalOrderStatus(status: OrderStatus) {
  return TERMINAL_ORDER_STATUSES.has(status);
}

export function getActivePreparationTasks(order: OrderLifecycleOrderSnapshot) {
  return (order.preparationTasks ?? []).filter(
    (task) => task.status !== PreparationTaskStatus.cancelled,
  );
}

export function hasPendingPreparationTasks(
  order: OrderLifecycleOrderSnapshot,
) {
  return getActivePreparationTasks(order).some(
    (task) => task.status !== PreparationTaskStatus.ready,
  );
}

export function allActivePreparationTasksReady(
  order: OrderLifecycleOrderSnapshot,
) {
  const activeTasks = getActivePreparationTasks(order);

  return (
    activeTasks.length > 0 &&
    activeTasks.every((task) => task.status === PreparationTaskStatus.ready)
  );
}

export function explainDeniedTransition(
  order: OrderLifecycleOrderSnapshot | OrderStatus,
  action: OrderLifecycleAction,
): OrderLifecycleDeniedReason | null {
  const snapshot =
    typeof order === 'string' ? { status: order as OrderStatus } : order;
  const status = snapshot.status;

  if (action !== 'submit' && isTerminalOrderStatus(status)) {
    return 'order_already_terminal';
  }

  switch (action) {
    case 'submit':
      return null;
    case 'accept':
    case 'reject':
      return status === OrderStatus.submitted ? null : 'order_not_submitted';
    case 'start_preparation':
    case 'system_preparation_started':
      return status === OrderStatus.cashier_accepted
        ? null
        : 'invalid_order_transition';
    case 'mark_preparation_ready':
    case 'system_preparation_ready':
      if (
        status !== OrderStatus.cashier_accepted &&
        status !== OrderStatus.preparing
      ) {
        return 'invalid_order_transition';
      }

      return hasPendingPreparationTasks(snapshot)
        ? 'order_has_pending_preparation_tasks'
        : null;
    case 'serve':
      if (status !== OrderStatus.ready) {
        return hasPendingPreparationTasks(snapshot)
          ? 'order_has_pending_preparation_tasks'
          : 'order_not_ready_to_serve';
      }

      return null;
    case 'complete':
      return status === OrderStatus.served ? null : 'order_not_served';
    case 'cancel':
      return CANCELLABLE_ORDER_STATUSES.has(status)
        ? null
        : 'cancellation_not_allowed_from_status';
    default:
      return 'invalid_order_transition';
  }
}

export function canTransition(
  order: OrderLifecycleOrderSnapshot | OrderStatus,
  action: OrderLifecycleAction,
) {
  return explainDeniedTransition(order, action) === null;
}

export function assertTransitionAllowed(
  order: OrderLifecycleOrderSnapshot | OrderStatus,
  action: OrderLifecycleAction,
) {
  const reason = explainDeniedTransition(order, action);

  if (reason) {
    throw new Error(reason);
  }
}

export function getAllowedActions(order: OrderLifecycleOrderSnapshot) {
  return STAFF_ACTIONS.filter((action) => canTransition(order, action));
}

export function getBlockedReasons(order: OrderLifecycleOrderSnapshot) {
  return STAFF_ACTIONS.reduce<
    Partial<Record<OrderLifecycleAction, OrderLifecycleDeniedReason>>
  >((blockedReasons, action) => {
    const reason = explainDeniedTransition(order, action);

    if (reason) {
      blockedReasons[action] = reason;
    }

    return blockedReasons;
  }, {});
}

export function getOrderProgressStep(
  status: OrderStatus,
): OrderLifecycleProgressStep {
  switch (status) {
    case OrderStatus.submitted:
      return 'cashier_review';
    case OrderStatus.cashier_accepted:
      return 'accepted';
    case OrderStatus.preparing:
      return 'preparing';
    case OrderStatus.ready:
      return 'ready_to_serve';
    case OrderStatus.served:
      return 'served';
    case OrderStatus.completed:
      return 'completed';
    case OrderStatus.cashier_rejected:
      return 'rejected';
    case OrderStatus.cancelled:
      return 'cancelled';
    default:
      return 'cashier_review';
  }
}

export function getNextExpectedRole(
  order: OrderLifecycleOrderSnapshot,
): OrderLifecycleExpectedRole {
  switch (order.status) {
    case OrderStatus.submitted:
      return 'cashier';
    case OrderStatus.cashier_accepted:
      return getActivePreparationTasks(order).length > 0 ? 'kitchen' : 'waiter';
    case OrderStatus.preparing:
      return 'kitchen';
    case OrderStatus.ready:
      return 'waiter';
    case OrderStatus.served:
      return 'cashier';
    default:
      return 'none';
  }
}

export function getOrderLifecycleState(order: OrderLifecycleOrderSnapshot) {
  return {
    status: order.status,
    isTerminal: isTerminalOrderStatus(order.status),
    allowedActions: getAllowedActions(order),
    blockedReasons: getBlockedReasons(order),
    nextExpectedRole: getNextExpectedRole(order),
    progressStep: getOrderProgressStep(order.status),
    customerLabel: CUSTOMER_STATUS_COPY[order.status],
  };
}
