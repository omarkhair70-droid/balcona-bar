import { TableSessionStatus, WaiterCallType } from '@prisma/client';
import { WaiterCallsService } from './waiter-calls.service';

const tableSession = {
  id: 'session-1',
  companyId: 'company-1',
  branchId: 'branch-1',
  tableId: 'table-1',
  status: TableSessionStatus.active,
  expiresAt: null,
};

const waiterCallResponse = {
  waiterCall: {
    id: 'waiter-call-1',
    tableSessionId: tableSession.id,
    status: 'open',
  },
};

function createService() {
  const tx = {
    tableSession: {
      findUnique: jest.fn().mockResolvedValue(tableSession),
    },
    order: {
      findUnique: jest.fn(),
    },
    waiterCall: {
      create: jest.fn().mockResolvedValue({ id: 'waiter-call-1' }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'waiter-call-1',
        tableSessionId: tableSession.id,
        status: 'open',
      }),
      update: jest.fn().mockResolvedValue({ id: 'waiter-call-1' }),
    },
    waiterCallEvent: {
      create: jest.fn().mockResolvedValue({ id: 'waiter-call-event-1' }),
    },
    staffUser: {
      findUnique: jest.fn().mockResolvedValue({ id: 'staff-1' }),
    },
  };
  let insideTransaction = false;
  const prisma = {
    $transaction: jest.fn(async (callback: (txClient: typeof tx) => Promise<unknown>) => {
      insideTransaction = true;
      try {
        return await callback(tx);
      } finally {
        insideTransaction = false;
      }
    }),
  };
  const presenceNotificationsService = {
    createWaiterCallCreatedNotification: jest.fn().mockResolvedValue(undefined),
    createWaiterCallAcknowledgedNotification: jest.fn().mockResolvedValue(undefined),
    createWaiterCallResolvedNotification: jest.fn().mockResolvedValue(undefined),
  };
  const realtimeEventsService = {
    recordWaiterCallCreated: jest.fn().mockResolvedValue(undefined),
    recordWaiterCallAcknowledged: jest.fn().mockResolvedValue(undefined),
    recordWaiterCallResolved: jest.fn().mockResolvedValue(undefined),
    recordWaiterCallCancelled: jest.fn().mockResolvedValue(undefined),
  };
  const tableAttentionService = {
    recalculateForTableSession: jest.fn().mockResolvedValue(undefined),
  };
  const service = new WaiterCallsService(
    prisma as never,
    presenceNotificationsService as never,
    realtimeEventsService as never,
    tableAttentionService as never,
  ) as any;

  service.getWaiterCallResponse = jest.fn(async () => {
    expect(insideTransaction).toBe(false);

    return waiterCallResponse;
  });

  return {
    service: service as WaiterCallsService & Record<string, jest.Mock>,
    tx,
    prisma,
    presenceNotificationsService,
    realtimeEventsService,
    tableAttentionService,
  };
}

describe('WaiterCallsService createForTableSession', () => {
  it('creates a waiter call and hydrates the response after the transaction commits', async () => {
    const { service, tx, prisma } = createService();

    await expect(
      service.createForTableSession(tableSession.id, {
        type: WaiterCallType.call_waiter,
        message: 'Smoke waiter call',
        priority: 1,
      }),
    ).resolves.toEqual(waiterCallResponse);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.waiterCall.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tableSessionId: tableSession.id,
        tableId: tableSession.tableId,
        type: WaiterCallType.call_waiter,
        status: 'open',
      }),
      select: { id: true },
    });
    expect((service as any).getWaiterCallResponse).toHaveBeenCalledWith(
      'waiter-call-1',
      prisma,
    );
  });

  it('does not fail creation when post-commit waiter call side effects fail', async () => {
    const {
      service,
      presenceNotificationsService,
      realtimeEventsService,
      tableAttentionService,
    } = createService();
    presenceNotificationsService.createWaiterCallCreatedNotification.mockRejectedValue(
      new Error('notification unavailable'),
    );
    realtimeEventsService.recordWaiterCallCreated.mockRejectedValue(
      new Error('realtime unavailable'),
    );
    tableAttentionService.recalculateForTableSession.mockRejectedValue(
      new Error('attention unavailable'),
    );

    await expect(
      service.createForTableSession(tableSession.id, {
        type: WaiterCallType.call_waiter,
        message: 'Smoke waiter call',
      }),
    ).resolves.toEqual(waiterCallResponse);
  });

  it('keeps the post-commit side-effect runner best-effort', async () => {
    const {
      service,
      presenceNotificationsService,
      realtimeEventsService,
      tableAttentionService,
    } = createService();
    presenceNotificationsService.createWaiterCallCreatedNotification.mockRejectedValue(
      new Error('notification unavailable'),
    );
    realtimeEventsService.recordWaiterCallCreated.mockRejectedValue(
      new Error('realtime unavailable'),
    );
    tableAttentionService.recalculateForTableSession.mockRejectedValue(
      new Error('attention unavailable'),
    );

    await expect(
      (service as any).runWaiterCallPostCommitSideEffects({
        waiterCallId: 'waiter-call-1',
        tableSessionId: tableSession.id,
        action: 'created',
      }),
    ).resolves.toBeUndefined();
  });

  it('acknowledges when post-commit notification, realtime, and attention fail', async () => {
    const {
      service,
      tx,
      prisma,
      presenceNotificationsService,
      realtimeEventsService,
      tableAttentionService,
    } = createService();
    presenceNotificationsService.createWaiterCallAcknowledgedNotification.mockRejectedValue(
      new Error('notification unavailable'),
    );
    realtimeEventsService.recordWaiterCallAcknowledged.mockRejectedValue(
      new Error('realtime unavailable'),
    );
    tableAttentionService.recalculateForTableSession.mockRejectedValue(
      new Error('attention unavailable'),
    );

    await expect(service.acknowledge('waiter-call-1')).resolves.toEqual(
      waiterCallResponse,
    );

    expect(tx.waiterCall.update).toHaveBeenCalledWith({
      where: { id: 'waiter-call-1' },
      data: expect.objectContaining({ status: 'acknowledged' }),
    });
    expect(tx.waiterCallEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        waiterCallId: 'waiter-call-1',
        type: 'acknowledged',
      }),
    });
    expect((service as any).getWaiterCallResponse).toHaveBeenCalledWith(
      'waiter-call-1',
      prisma,
    );
  });

  it('resolves when post-commit notification, realtime, and attention fail', async () => {
    const {
      service,
      tx,
      prisma,
      presenceNotificationsService,
      realtimeEventsService,
      tableAttentionService,
    } = createService();
    presenceNotificationsService.createWaiterCallResolvedNotification.mockRejectedValue(
      new Error('notification unavailable'),
    );
    realtimeEventsService.recordWaiterCallResolved.mockRejectedValue(
      new Error('realtime unavailable'),
    );
    tableAttentionService.recalculateForTableSession.mockRejectedValue(
      new Error('attention unavailable'),
    );

    await expect(service.resolve('waiter-call-1')).resolves.toEqual(
      waiterCallResponse,
    );

    expect(tx.waiterCall.update).toHaveBeenCalledWith({
      where: { id: 'waiter-call-1' },
      data: expect.objectContaining({ status: 'resolved' }),
    });
    expect(tx.waiterCallEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        waiterCallId: 'waiter-call-1',
        type: 'resolved',
      }),
    });
    expect((service as any).getWaiterCallResponse).toHaveBeenCalledWith(
      'waiter-call-1',
      prisma,
    );
  });

  it('cancels when post-commit realtime and attention fail', async () => {
    const {
      service,
      tx,
      prisma,
      realtimeEventsService,
      tableAttentionService,
    } = createService();
    realtimeEventsService.recordWaiterCallCancelled.mockRejectedValue(
      new Error('realtime unavailable'),
    );
    tableAttentionService.recalculateForTableSession.mockRejectedValue(
      new Error('attention unavailable'),
    );

    await expect(service.cancel('waiter-call-1')).resolves.toEqual(
      waiterCallResponse,
    );

    expect(tx.waiterCall.update).toHaveBeenCalledWith({
      where: { id: 'waiter-call-1' },
      data: expect.objectContaining({ status: 'cancelled' }),
    });
    expect(tx.waiterCallEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        waiterCallId: 'waiter-call-1',
        type: 'cancelled',
      }),
    });
    expect((service as any).getWaiterCallResponse).toHaveBeenCalledWith(
      'waiter-call-1',
      prisma,
    );
  });
});
