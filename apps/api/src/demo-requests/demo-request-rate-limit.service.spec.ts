import { HttpException, ServiceUnavailableException } from "@nestjs/common";
import { DemoRequestRateLimitService } from "./demo-request-rate-limit.service";

describe("DemoRequestRateLimitService", () => {
  const redis = { eval: jest.fn() };
  const values: Record<string, unknown> = {
    "demoRequests.rateLimitWindowSeconds": 900,
    "demoRequests.rateLimitMax": 5,
    "app.environment": "staging",
  };
  const config = { get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback) };
  const service = new DemoRequestRateLimitService(redis as never, config as never);

  beforeEach(() => {
    jest.clearAllMocks();
    values["app.environment"] = "staging";
  });

  it("allows requests within the configured window", async () => {
    redis.eval.mockResolvedValue([5, 600]);
    await expect(service.assertAllowed("127.0.0.1:omar@example.com")).resolves.toBeUndefined();
    expect(redis.eval.mock.calls[0][2]).toMatch(/^balcona:demo-requests:[a-f0-9]{32}$/);
  });

  it("returns a retryable 429 after the limit", async () => {
    redis.eval.mockResolvedValue([6, 420]);
    await expect(service.assertAllowed("127.0.0.1:omar@example.com")).rejects.toBeInstanceOf(HttpException);
  });

  it("fails closed in production when protection is unavailable", async () => {
    values["app.environment"] = "production";
    redis.eval.mockRejectedValue(new Error("redis unavailable"));
    await expect(service.assertAllowed("127.0.0.1:omar@example.com")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
