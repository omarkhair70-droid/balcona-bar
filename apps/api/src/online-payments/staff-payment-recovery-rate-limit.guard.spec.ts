import { HttpException } from "@nestjs/common";
import { StaffPaymentRecoveryRateLimitGuard } from "./staff-payment-recovery-rate-limit.guard";

function context(request: Record<string, any>, response: Record<string, any>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as never;
}

describe("StaffPaymentRecoveryRateLimitGuard", () => {
  it("rate limits provider recovery by authenticated staff identity", async () => {
    const paymentRateLimitService = {
      consume: jest.fn().mockResolvedValue({
        allowed: true,
        limit: 10,
        remaining: 9,
        retryAfterSeconds: 60,
      }),
    };
    const response = { setHeader: jest.fn() };
    const guard = new StaffPaymentRecoveryRateLimitGuard(
      paymentRateLimitService as never,
    );

    await expect(
      guard.canActivate(
        context(
          {
            staffUser: { id: "staff-1" },
          },
          response,
        ),
      ),
    ).resolves.toBe(true);

    expect(paymentRateLimitService.consume).toHaveBeenCalledWith(
      "staff_recover",
      "staff-1",
      "provider-recovery",
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      "RateLimit-Remaining",
      "9",
    );
  });

  it("returns 429 and Retry-After when staff recovery limit is exceeded", async () => {
    const paymentRateLimitService = {
      consume: jest.fn().mockResolvedValue({
        allowed: false,
        limit: 10,
        remaining: 0,
        retryAfterSeconds: 41,
      }),
    };
    const response = { setHeader: jest.fn() };
    const guard = new StaffPaymentRecoveryRateLimitGuard(
      paymentRateLimitService as never,
    );

    let thrown: unknown;

    try {
      await guard.canActivate(
        context(
          {
            staffUser: { id: "staff-1" },
          },
          response,
        ),
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(429);
    expect((thrown as HttpException).getResponse()).toMatchObject({
      code: "payment_recovery_rate_limit_exceeded",
    });
    expect(response.setHeader).toHaveBeenCalledWith("Retry-After", "41");
  });
});
