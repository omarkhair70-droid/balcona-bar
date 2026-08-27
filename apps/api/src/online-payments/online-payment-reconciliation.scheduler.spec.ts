import { OnlinePaymentReconciliationScheduler } from "./online-payment-reconciliation.scheduler";

function config(enabled = true, provider = "paymob") {
  return {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === "onlinePayments.reconciliation.enabled") {
        return enabled;
      }

      if (key === "onlinePayments.reconciliation.intervalSeconds") {
        return 60;
      }

      if (key === "onlinePayments.provider") {
        return provider;
      }

      return fallback;
    }),
  };
}

describe("OnlinePaymentReconciliationScheduler", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("runs reconciliation only after acquiring the distributed Redis lock", async () => {
    const redis = {
      set: jest.fn().mockResolvedValue("OK"),
      eval: jest.fn().mockResolvedValue(1),
    };
    const onlinePaymentsService = {
      reconcilePendingPaymobIntents: jest.fn().mockResolvedValue({
        enabled: true,
        attempted: 2,
        recovered: 2,
        failed: 0,
      }),
      reconcilePendingPaymobOperations: jest.fn().mockResolvedValue({
        enabled: true,
        attempted: 1,
        recovered: 1,
        failed: 0,
      }),
      reconcilePendingFawryIntents: jest.fn(),
    };
    const scheduler = new OnlinePaymentReconciliationScheduler(
      redis as never,
      config() as never,
      onlinePaymentsService as never,
    );

    await (scheduler as any).runTick();

    expect(redis.set).toHaveBeenCalledWith(
      "balcona:payments:paymob-reconciliation:lock",
      expect.any(String),
      "PX",
      120000,
      "NX",
    );
    expect(
      onlinePaymentsService.reconcilePendingPaymobIntents,
    ).toHaveBeenCalledTimes(1);
    expect(
      onlinePaymentsService.reconcilePendingPaymobOperations,
    ).toHaveBeenCalledTimes(1);
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it("runs Fawry stale-intent recovery without Paymob operation reconciliation", async () => {
    const redis = {
      set: jest.fn().mockResolvedValue("OK"),
      eval: jest.fn().mockResolvedValue(1),
    };
    const onlinePaymentsService = {
      reconcilePendingPaymobIntents: jest.fn(),
      reconcilePendingPaymobOperations: jest.fn(),
      reconcilePendingFawryIntents: jest.fn().mockResolvedValue({
        enabled: true,
        attempted: 2,
        recovered: 2,
        failed: 0,
      }),
    };
    const scheduler = new OnlinePaymentReconciliationScheduler(
      redis as never,
      config(true, "fawry") as never,
      onlinePaymentsService as never,
    );

    await (scheduler as any).runTick();

    expect(redis.set).toHaveBeenCalledWith(
      "balcona:payments:fawry-reconciliation:lock",
      expect.any(String),
      "PX",
      120000,
      "NX",
    );
    expect(
      onlinePaymentsService.reconcilePendingFawryIntents,
    ).toHaveBeenCalledTimes(1);
    expect(
      onlinePaymentsService.reconcilePendingPaymobIntents,
    ).not.toHaveBeenCalled();
    expect(
      onlinePaymentsService.reconcilePendingPaymobOperations,
    ).not.toHaveBeenCalled();
  });

  it("skips reconciliation when another API instance owns the lock", async () => {
    const redis = {
      set: jest.fn().mockResolvedValue(null),
      eval: jest.fn(),
    };
    const onlinePaymentsService = {
      reconcilePendingPaymobIntents: jest.fn(),
      reconcilePendingPaymobOperations: jest.fn(),
      reconcilePendingFawryIntents: jest.fn(),
    };
    const scheduler = new OnlinePaymentReconciliationScheduler(
      redis as never,
      config() as never,
      onlinePaymentsService as never,
    );

    await (scheduler as any).runTick();

    expect(
      onlinePaymentsService.reconcilePendingPaymobIntents,
    ).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it("does not create an interval when reconciliation is disabled", () => {
    jest.useFakeTimers();
    const redis = {
      set: jest.fn(),
      eval: jest.fn(),
    };
    const onlinePaymentsService = {
      reconcilePendingPaymobIntents: jest.fn(),
      reconcilePendingPaymobOperations: jest.fn(),
      reconcilePendingFawryIntents: jest.fn(),
    };
    const scheduler = new OnlinePaymentReconciliationScheduler(
      redis as never,
      config(false) as never,
      onlinePaymentsService as never,
    );

    scheduler.onModuleInit();
    jest.advanceTimersByTime(120000);

    expect(redis.set).not.toHaveBeenCalled();
    scheduler.onModuleDestroy();
  });
});
