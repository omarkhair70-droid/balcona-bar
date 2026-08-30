import { ConfigService } from "@nestjs/config";
import { ServiceUnavailableException } from "@nestjs/common";
import { PaymentRateLimitService } from "./payment-rate-limit.service";

function config(environment = "test") {
  const values: Record<string, unknown> = {
    "app.environment": environment,
    "onlinePayments.rateLimit.windowSeconds": 60,
    "onlinePayments.rateLimit.customerCreateMax": 2,
    "onlinePayments.rateLimit.customerReadMax": 5,
    "onlinePayments.rateLimit.staffRecoveryMax": 3,
  };

  return {
    get: jest.fn((key: string, fallback?: unknown) =>
      values[key] === undefined ? fallback : values[key],
    ),
  } as unknown as ConfigService;
}

describe("PaymentRateLimitService", () => {
  it("uses the distributed Redis counter and reports remaining capacity", async () => {
    const redis = {
      eval: jest.fn().mockResolvedValue([2, 51]),
    };
    const service = new PaymentRateLimitService(redis as never, config());

    await expect(
      service.consume("customer_create", "identity-1", "session-1"),
    ).resolves.toEqual({
      allowed: true,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 51,
    });
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it("denies requests above the configured limit", async () => {
    const redis = {
      eval: jest.fn().mockResolvedValue([3, 44]),
    };
    const service = new PaymentRateLimitService(redis as never, config());

    await expect(
      service.consume("customer_create", "identity-1", "session-1"),
    ).resolves.toEqual({
      allowed: false,
      limit: 2,
      remaining: 0,
      retryAfterSeconds: 44,
    });
  });

  it("uses the dedicated staff recovery limit", async () => {
    const redis = {
      eval: jest.fn().mockResolvedValue([3, 39]),
    };
    const service = new PaymentRateLimitService(redis as never, config());

    await expect(
      service.consume("staff_recover", "staff-1", "provider-recovery"),
    ).resolves.toEqual({
      allowed: true,
      limit: 3,
      remaining: 0,
      retryAfterSeconds: 39,
    });
  });

  it("uses a bounded local fallback outside production when Redis is unavailable", async () => {
    const redis = {
      eval: jest.fn().mockRejectedValue(new Error("redis unavailable")),
    };
    const service = new PaymentRateLimitService(redis as never, config("test"));

    await expect(
      service.consume("customer_create", "identity-1", "session-1"),
    ).resolves.toMatchObject({ allowed: true, remaining: 1 });
    await expect(
      service.consume("customer_create", "identity-1", "session-1"),
    ).resolves.toMatchObject({ allowed: true, remaining: 0 });
    await expect(
      service.consume("customer_create", "identity-1", "session-1"),
    ).resolves.toMatchObject({ allowed: false, remaining: 0 });
  });

  it("fails closed in production when distributed rate limiting is unavailable", async () => {
    const redis = {
      eval: jest.fn().mockRejectedValue(new Error("redis unavailable")),
    };
    const service = new PaymentRateLimitService(
      redis as never,
      config("production"),
    );

    await expect(
      service.consume("customer_create", "identity-1", "session-1"),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
