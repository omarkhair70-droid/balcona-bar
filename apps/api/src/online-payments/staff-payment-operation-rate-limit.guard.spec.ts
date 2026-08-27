import { HttpException } from "@nestjs/common";
import { StaffPaymentOperationRateLimitGuard } from "./staff-payment-operation-rate-limit.guard";

function context(request: Record<string, any>, response: Record<string, any>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as never;
}

describe("StaffPaymentOperationRateLimitGuard", () => {
  it("uses the dedicated staff financial-operation bucket", async () => {
    const paymentRateLimitService = {
      consume: jest.fn().mockResolvedValue({
        allowed: true,
        limit: 5,
        remaining: 4,
        retryAfterSeconds: 60,
      }),
    };
    const response = { setHeader: jest.fn() };
    const guard = new StaffPaymentOperationRateLimitGuard(
      paymentRateLimitService as never,
    );

    await expect(
      guard.canActivate(
        context({ staffUser: { id: "staff-1" } }, response),
      ),
    ).resolves.toBe(true);

    expect(paymentRateLimitService.consume).toHaveBeenCalledWith(
      "staff_operation",
      "staff-1",
      "provider-operation",
    );
  });

  it("returns 429 and Retry-After above the operation limit", async () => {
    const paymentRateLimitService = {
      consume: jest.fn().mockResolvedValue({
        allowed: false,
        limit: 5,
        remaining: 0,
        retryAfterSeconds: 37,
      }),
    };
    const response = { setHeader: jest.fn() };
    const guard = new StaffPaymentOperationRateLimitGuard(
      paymentRateLimitService as never,
    );

    let thrown: unknown;

    try {
      await guard.canActivate(
        context({ staffUser: { id: "staff-1" } }, response),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(429);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "payment_operation_rate_limit_exceeded",
    });
    expect(response.setHeader).toHaveBeenCalledWith("Retry-After", "37");
  });
});
