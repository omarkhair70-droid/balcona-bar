import { OrderStatus, PreparationTaskStatus } from '@prisma/client';
import {
  canTransition,
  explainDeniedTransition,
  getOrderLifecycleState,
} from './order-lifecycle.policy';

describe('order lifecycle policy', () => {
  it('allows submitted orders to be accepted, rejected, or cancelled', () => {
    for (const action of ['accept', 'reject', 'cancel'] as const) {
      expect(canTransition(OrderStatus.submitted, action)).toBe(true);
    }
  });

  it('allows preparation start from accepted and ready when all active tasks are ready', () => {
    expect(
      canTransition(OrderStatus.cashier_accepted, 'start_preparation'),
    ).toBe(true);
    expect(
      canTransition(
        {
          status: OrderStatus.preparing,
          preparationTasks: [{ status: PreparationTaskStatus.ready }],
        },
        'system_preparation_ready',
      ),
    ).toBe(true);
  });

  it('denies ready to complete because orders must be served first', () => {
    expect(explainDeniedTransition(OrderStatus.ready, 'complete')).toBe(
      'order_not_served',
    );
  });

  it('denies serving while active preparation tasks are pending', () => {
    expect(
      explainDeniedTransition(
        {
          status: OrderStatus.preparing,
          preparationTasks: [
            { status: PreparationTaskStatus.ready },
            { status: PreparationTaskStatus.pending },
          ],
        },
        'serve',
      ),
    ).toBe('order_has_pending_preparation_tasks');
  });

  it('allows ready orders to be served and served orders to be completed', () => {
    expect(canTransition(OrderStatus.ready, 'serve')).toBe(true);
    expect(canTransition(OrderStatus.served, 'complete')).toBe(true);
  });

  it('treats completed, rejected, and cancelled as terminal', () => {
    for (const status of [
      OrderStatus.completed,
      OrderStatus.cashier_rejected,
      OrderStatus.cancelled,
    ]) {
      expect(explainDeniedTransition(status, 'cancel')).toBe(
        'order_already_terminal',
      );
    }
  });

  it('builds a lifecycle snapshot with allowed actions and blocked reasons', () => {
    const lifecycle = getOrderLifecycleState({
      status: OrderStatus.ready,
      preparationTasks: [{ status: PreparationTaskStatus.ready }],
    });

    expect(lifecycle.allowedActions).toEqual(['serve']);
    expect(lifecycle.blockedReasons.complete).toBe('order_not_served');
    expect(lifecycle.nextExpectedRole).toBe('waiter');
    expect(lifecycle.progressStep).toBe('ready_to_serve');
    expect(lifecycle.customerLabel).toBe('Ready');
  });
});
