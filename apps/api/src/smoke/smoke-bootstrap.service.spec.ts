import { ConfigService } from "@nestjs/config";
import { SmokeBootstrapService } from "./smoke-bootstrap.service";
import {
  SMOKE_BOOTSTRAP_EMAILS,
  SMOKE_BOOTSTRAP_IDENTIFIERS,
} from "./smoke-bootstrap.constants";

function serviceWithConfig(config: Record<string, unknown>) {
  const configService = {
    get: jest.fn((key: string, fallback?: unknown) =>
      Object.prototype.hasOwnProperty.call(config, key) ? config[key] : fallback,
    ),
  } as unknown as ConfigService;

  return new SmokeBootstrapService({} as never, configService);
}

describe("SmokeBootstrapService", () => {
  it("fails clearly when the bootstrap token is missing from config", async () => {
    const service = serviceWithConfig({
      "app.environment": "staging",
      "app.nodeEnvironment": "production",
      "smokeBootstrap.enabled": true,
    });

    await expect(service.bootstrap(smokeBody(), "token")).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "SMOKE_BOOTSTRAP_TOKEN_MISSING",
      }),
    });
  });

  it("blocks production environments even when explicitly enabled", async () => {
    const service = serviceWithConfig({
      "app.environment": "production",
      "app.nodeEnvironment": "production",
      "smokeBootstrap.enabled": true,
      "smokeBootstrap.token": "token",
    });

    await expect(service.bootstrap(smokeBody(), "token")).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "SMOKE_BOOTSTRAP_DISABLED_IN_PRODUCTION",
      }),
    });
  });

  it("uses only smoke-prefixed identifiers and deterministic smoke emails", () => {
    expect(SMOKE_BOOTSTRAP_IDENTIFIERS.companySlug).toMatch(/^balcona-smoke/);
    expect(SMOKE_BOOTSTRAP_IDENTIFIERS.branchSlug).toMatch(/smoke/);
    expect(SMOKE_BOOTSTRAP_IDENTIFIERS.tableOneQrToken).toMatch(/smoke/);
    expect(SMOKE_BOOTSTRAP_IDENTIFIERS.menuItemSlug).toMatch(/^smoke-/);
    expect(Object.values(SMOKE_BOOTSTRAP_EMAILS)).toEqual(
      expect.arrayContaining([
        "smoke-owner@balcona.test",
        "smoke-platform@balcona.test",
      ]),
    );
  });
});

function smokeBody() {
  const password = "StrongSmokePassword123!";

  return {
    credentials: {
      owner: { email: SMOKE_BOOTSTRAP_EMAILS.owner, password },
      cashier: { email: SMOKE_BOOTSTRAP_EMAILS.cashier, password },
      kitchen: { email: SMOKE_BOOTSTRAP_EMAILS.kitchen, password },
      barista: { email: SMOKE_BOOTSTRAP_EMAILS.barista, password },
      waiter: { email: SMOKE_BOOTSTRAP_EMAILS.waiter, password },
      platform: { email: SMOKE_BOOTSTRAP_EMAILS.platform, password },
    },
  };
}
