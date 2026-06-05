import {
  BillStatus,
  OnlinePaymentEventType,
  OnlinePaymentIntentStatus,
  OnlinePaymentProvider,
} from "@prisma/client";
import { OnlinePaymentsService } from "./online-payments.service";

const now = new Date("2026-06-05T10:00:00.000Z");

function intent(
  status: OnlinePaymentIntentStatus = OnlinePaymentIntentStatus.pending,
) {
  return {
    id: "intent-1",
    companyId: "company-1",
    branchId: "branch-1",
    tableSessionId: "session-1",
    billId: "bill-1",
    provider: OnlinePaymentProvider.mock,
    providerIntentId: "mock-intent-1",
    providerCheckoutUrl: "http://localhost:3001/mock-payments/mock-intent-1",
    idempotencyKey: "key-1",
    status,
    amountMinor: 12500,
    currency: "EGP",
    customerReturnUrl: null,
    checkoutExpiresAt: new Date("2026-06-05T10:15:00.000Z"),
    succeededAt: status === OnlinePaymentIntentStatus.succeeded ? now : null,
    failedAt: null,
    cancelledAt: null,
    expiredAt: null,
    failureCode: null,
    failureMessage: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
    bill: {
      id: "bill-1",
      billNumber: "BILL-00001",
      status:
        status === OnlinePaymentIntentStatus.succeeded
          ? BillStatus.paid
          : BillStatus.payment_pending,
      totalMinor: 12500,
      paidMinor: status === OnlinePaymentIntentStatus.succeeded ? 12500 : 0,
      balanceDueMinor:
        status === OnlinePaymentIntentStatus.succeeded ? 0 : 12500,
      currency: "EGP",
    },
    tableSession: {
      id: "session-1",
      status: "active",
      table: {
        id: "table-1",
        code: "T01",
        displayName: "Table 1",
      },
    },
    events: [],
  };
}

function createService() {
  const tx = {
    onlinePaymentEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "event-1" }),
    },
    onlinePaymentIntent: {
      findFirst: jest.fn().mockResolvedValue(intent()),
      findUnique: jest
        .fn()
        .mockResolvedValue(intent(OnlinePaymentIntentStatus.succeeded)),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(0),
    },
    bill: {
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback) => callback(tx)),
    ...tx,
  };
  const configService = {
    get: jest.fn((key: string) => {
      if (key === "onlinePayments.enabled") {
        return true;
      }

      if (key === "onlinePayments.provider") {
        return "mock";
      }

      if (key === "onlinePayments.mockEnabled") {
        return true;
      }

      if (key === "onlinePayments.checkoutBaseUrl") {
        return "http://localhost:3001";
      }

      return undefined;
    }),
  };
  const billsService = {
    settleBillWithOnlinePayment: jest.fn().mockResolvedValue({
      settled: true,
      reason: "settled",
      billResponse: { bill: { id: "bill-1", status: BillStatus.paid } },
    }),
  };
  const realtimeEventsService = {
    recordOnlinePaymentIntentCreated: jest.fn().mockResolvedValue(undefined),
    recordOnlinePaymentSucceeded: jest.fn().mockResolvedValue(undefined),
    recordOnlinePaymentFailed: jest.fn().mockResolvedValue(undefined),
  };
  const service = new OnlinePaymentsService(
    prisma as never,
    configService as never,
    billsService as never,
    realtimeEventsService as never,
  );

  return { service, tx, billsService, realtimeEventsService };
}

describe("OnlinePaymentsService", () => {
  it("settles a mock success webhook once through the guarded bill settlement", async () => {
    const { service, tx, billsService, realtimeEventsService } =
      createService();

    const result = await service.processMockWebhook({
      intentId: "intent-1",
      providerEventId: "evt-1",
      status: "succeeded",
    });

    expect(tx.onlinePaymentIntent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "intent-1",
          status: { in: ["pending", "requires_action"] },
        }),
        data: expect.objectContaining({
          status: OnlinePaymentIntentStatus.succeeded,
        }),
      }),
    );
    expect(billsService.settleBillWithOnlinePayment).toHaveBeenCalledTimes(1);
    expect(tx.onlinePaymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: OnlinePaymentEventType.settlement_completed,
        }),
      }),
    );
    expect(
      realtimeEventsService.recordOnlinePaymentSucceeded,
    ).toHaveBeenCalledWith("intent-1", tx);
    expect(result.settlement).toMatchObject({ settled: true });
  });

  it("ignores a duplicate mock webhook event without double-settling", async () => {
    const { service, tx, billsService } = createService();
    tx.onlinePaymentEvent.findUnique.mockResolvedValueOnce({
      onlinePaymentIntentId: "intent-1",
    });

    const result = await service.processMockWebhook({
      intentId: "intent-1",
      providerEventId: "evt-duplicate",
      status: "succeeded",
    });

    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(tx.onlinePaymentEvent.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      outcome: "duplicate_event",
      settlement: { settled: false, reason: "duplicate_event" },
    });
  });

  it("records settlement_skipped when online success arrives after manual payment", async () => {
    const { service, tx, billsService } = createService();
    billsService.settleBillWithOnlinePayment.mockResolvedValueOnce({
      settled: false,
      reason: "bill_already_paid",
      message: "Bill is already paid",
      billResponse: { bill: { id: "bill-1", status: BillStatus.paid } },
    });

    const result = await service.processMockWebhook({
      intentId: "intent-1",
      providerEventId: "evt-after-manual",
      status: "succeeded",
    });

    expect(billsService.settleBillWithOnlinePayment).toHaveBeenCalledTimes(1);
    expect(tx.onlinePaymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: OnlinePaymentEventType.settlement_skipped,
        }),
      }),
    );
    expect(result.settlement).toMatchObject({
      settled: false,
      reason: "bill_already_paid",
    });
  });

  it("rejects an unsafe success amount without bill settlement", async () => {
    const { service, tx, billsService } = createService();

    await expect(
      service.processMockWebhook({
        intentId: "intent-1",
        providerEventId: "evt-amount-mismatch",
        status: "succeeded",
        amountMinor: 9900,
      }),
    ).rejects.toThrow("Online payment amount does not match the intent amount");

    expect(billsService.settleBillWithOnlinePayment).not.toHaveBeenCalled();
    expect(tx.onlinePaymentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: OnlinePaymentEventType.settlement_skipped,
        }),
      }),
    );
  });
});
