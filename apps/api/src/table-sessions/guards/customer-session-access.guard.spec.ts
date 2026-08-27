import { UnauthorizedException } from "@nestjs/common";
import { CustomerSessionAccessGuard } from "./customer-session-access.guard";

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}

describe("CustomerSessionAccessGuard", () => {
  it("validates the bearer token against the route table session and exposes identity context", async () => {
    const tableSessionAccessService = {
      validateAccessToken: jest.fn().mockResolvedValue({
        id: "identity-1",
        tableSessionId: "session-1",
        companyId: "company-1",
        branchId: "branch-1",
      }),
    };
    const guard = new CustomerSessionAccessGuard(
      tableSessionAccessService as never,
    );
    const request = {
      headers: { authorization: "Bearer customer-token" },
      params: { sessionId: "session-1" },
    } as Record<string, any>;

    await expect(guard.canActivate(context(request))).resolves.toBe(true);

    expect(tableSessionAccessService.validateAccessToken).toHaveBeenCalledWith(
      "customer-token",
      "session-1",
    );
    expect(request.customerSessionIdentity).toEqual({
      id: "identity-1",
      tableSessionId: "session-1",
      companyId: "company-1",
      branchId: "branch-1",
    });
  });

  it("rejects a missing bearer token before access lookup", async () => {
    const tableSessionAccessService = {
      validateAccessToken: jest.fn(),
    };
    const guard = new CustomerSessionAccessGuard(
      tableSessionAccessService as never,
    );

    await expect(
      guard.canActivate(
        context({
          headers: {},
          params: { sessionId: "session-1" },
        }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(tableSessionAccessService.validateAccessToken).not.toHaveBeenCalled();
  });

  it("propagates token/session mismatch rejection", async () => {
    const tableSessionAccessService = {
      validateAccessToken: jest
        .fn()
        .mockRejectedValue(
          new UnauthorizedException("Token does not match table session"),
        ),
    };
    const guard = new CustomerSessionAccessGuard(
      tableSessionAccessService as never,
    );

    await expect(
      guard.canActivate(
        context({
          headers: { authorization: "Bearer token-for-another-session" },
          params: { sessionId: "session-1" },
        }),
      ),
    ).rejects.toThrow("Token does not match table session");
  });
});
