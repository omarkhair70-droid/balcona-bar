import { OnlinePaymentReconciliationRunStatus } from "@prisma/client";
import {
  OnlinePaymentSettlementReconciliationScheduler,
  previousClosedDayRange,
} from "./online-payment-settlement-reconciliation.scheduler";

function config(enabled = true) {
  const values: Record<string, unknown> = {
    "onlinePayments.settlementReconciliation.enabled": enabled,
    "onlinePayments.settlementReconciliation.intervalSeconds": 3600,
    "onlinePayments.settlementReconciliation.timezone": "Africa/Cairo",
    "onlinePayments.settlementReconciliation.maxScopesPerTick": 50,
  };

  return {
    get: jest.fn((key: string, fallback?: unknown) =>
      values[key] === undefined ? fallback : values[key],
    ),
  };
}

describe("OnlinePaymentSettlementReconciliationScheduler", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("calculates the previous closed Cairo calendar day as real UTC instants", () => {
    const range = previousClosedDayRange(
      new Date("2026-08-28T12:00:00.000Z"),
      "Africa/Cairo",
    );

    expect(range.label).toBe("2026-08-27");
    expect(range.start.toISOString()).toBe("2026-08-26T21:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-08-27T21:00:00.000Z");
  });

  it("runs each branch/currency scope once behind the distributed lock", async () => {
    const redis = {
      set: jest.fn().mockResolvedValue("OK"),
      eval: jest.fn().mockResolvedValue(1),
    };
    const paymentReconciliationService = {
      discoverPaymobReconciliationScopes: jest.fn().mockResolvedValue([
        { branchId: "branch-1", currency: "EGP" },
        { branchId: "branch-2", currency: "USD" },
      ]),
      runPaymobProviderReconciliation: jest.fn().mockResolvedValue({
        status: OnlinePaymentReconciliationRunStatus.matched,
      }),
    };
    const scheduler = new OnlinePaymentSettlementReconciliationScheduler(
      redis as never,
      config() as never,
      paymentReconciliationService as never,
    );

    await (scheduler as any).runTick(new Date("2026-08-28T12:00:00.000Z"));

    expect(redis.set).toHaveBeenCalledWith(
      "balcona:payments:paymob-settlement-reconciliation:lock",
      expect.any(String),
      "PX",
      7200000,
      "NX",
    );
    expect(
      paymentReconciliationService.discoverPaymobReconciliationScopes,
    ).toHaveBeenCalledWith(
      new Date("2026-08-26T21:00:00.000Z"),
      new Date("2026-08-27T21:00:00.000Z"),
      50,
    );
    expect(
      paymentReconciliationService.runPaymobProviderReconciliation,
    ).toHaveBeenNthCalledWith(1, "branch-1", undefined, {
      periodStart: "2026-08-26T21:00:00.000Z",
      periodEnd: "2026-08-27T21:00:00.000Z",
      currency: "EGP",
      idempotencyKey: "daily-paymob-settlement:2026-08-27:branch-1:EGP",
    });
    expect(
      paymentReconciliationService.runPaymobProviderReconciliation,
    ).toHaveBeenNthCalledWith(2, "branch-2", undefined, {
      periodStart: "2026-08-26T21:00:00.000Z",
      periodEnd: "2026-08-27T21:00:00.000Z",
      currency: "USD",
      idempotencyKey: "daily-paymob-settlement:2026-08-27:branch-2:USD",
    });
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it("does not reconcile when another API instance owns the lock", async () => {
    const redis = {
      set: jest.fn().mockResolvedValue(null),
      eval: jest.fn(),
    };
    const paymentReconciliationService = {
      discoverPaymobReconciliationScopes: jest.fn(),
      runPaymobProviderReconciliation: jest.fn(),
    };
    const scheduler = new OnlinePaymentSettlementReconciliationScheduler(
      redis as never,
      config() as never,
      paymentReconciliationService as never,
    );

    await (scheduler as any).runTick();

    expect(
      paymentReconciliationService.discoverPaymobReconciliationScopes,
    ).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it("does not schedule ticks when PAY-6 automatic reconciliation is disabled", () => {
    jest.useFakeTimers();
    const redis = {
      set: jest.fn(),
      eval: jest.fn(),
    };
    const paymentReconciliationService = {
      discoverPaymobReconciliationScopes: jest.fn(),
      runPaymobProviderReconciliation: jest.fn(),
    };
    const scheduler = new OnlinePaymentSettlementReconciliationScheduler(
      redis as never,
      config(false) as never,
      paymentReconciliationService as never,
    );

    scheduler.onModuleInit();
    jest.advanceTimersByTime(7200000);

    expect(redis.set).not.toHaveBeenCalled();
    scheduler.onModuleDestroy();
  });
});
