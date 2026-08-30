import { HttpException } from "@nestjs/common";
import { PaymentRateLimitGuard } from "./payment-rate-limit.guard";

function context(request: Record<string, any>, response: Record<string, any>) {
  const handler = () => undefined;
  class Controller {}

  return {
    getHandler: () => handler,
    getClass: () => Controller,
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as never;
}

describe("PaymentRateLimitGuard", () => {
  it("allows a verified customer payment request and publishes limit headers", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue("customer_create"),
    };
    const paymentRateLimitService = {
      consume: jest.fn().mockResolvedValue({
        allowed: true,
        limit: 6,
        remaining: 4,
        retryAfterSeconds: 60,
      }),
    };
    const response = { setHeader: jest.fn() };
    const request = {
      params: { sessionId: "session-1" },
      customerSessionIdentity: {
        id: "identity-1",
        tableSessionId: "session-1",
        companyId: "company-1",
        branchId: "branch-1",
      },
    };
    const guard = new PaymentRateLimitGuard(
      reflector as never,
      paymentRateLimitService as never,
    );

    await expect(guard.canActivate(context(request, response))).resolves.toBe(
      true,
    );

    expect(paymentRateLimitService.consume).toHaveBeenCalledWith(
      "customer_create",
      "identity-1",
      "session-1",
    );
    expect(response.setHeader).toHaveBeenCalledWith("RateLimit-Limit", "6");
    expect(response.setHeader).toHaveBeenCalledWith("RateLimit-Remaining", "4");
  });

  it("returns 429 with Retry-After after the customer payment limit is exceeded", async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue("customer_create"),
    };
    const paymentRateLimitService = {
      consume: jest.fn().mockResolvedValue({
        allowed: false,
        limit: 6,
        remaining: 0,
        retryAfterSeconds: 37,
      }),
    };
    const response = { setHeader: jest.fn() };
    const request = {
      params: { sessionId: "session-1" },
      customerSessionIdentity: {
        id: "identity-1",
        tableSessionId: "session-1",
        companyId: "company-1",
        branchId: "branch-1",
      },
    };
    const guard = new PaymentRateLimitGuard(
      reflector as never,
      paymentRateLimitService as never,
    );

    let thrown: unknown;

    try {
      await guard.canActivate(context(request, response));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(429);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "payment_rate_limit_exceeded",
    });
    expect(response.setHeader).toHaveBeenCalledWith("Retry-After", "37");
  });
});
