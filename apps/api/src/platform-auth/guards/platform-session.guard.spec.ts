import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { PlatformSessionGuard } from "./platform-session.guard";

function createContext(authorization?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {
          authorization,
        },
      }),
    }),
  } as ExecutionContext;
}

describe("PlatformSessionGuard", () => {
  it("requires a platform bearer token for platform endpoints", async () => {
    const guard = new PlatformSessionGuard({
      validateToken: jest.fn(),
    } as never);

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("does not accept a token rejected by the platform auth service", async () => {
    const guard = new PlatformSessionGuard({
      validateToken: jest
        .fn()
        .mockRejectedValue(new UnauthorizedException("Invalid platform session")),
    } as never);

    await expect(
      guard.canActivate(createContext("Bearer balcona_staff_token")),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
