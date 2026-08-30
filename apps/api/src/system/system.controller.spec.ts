import { SystemController } from "./system.controller";

describe("SystemController", () => {
  it("returns safe runtime metadata without secrets", async () => {
    const configValues: Record<string, string> = {
      "app.name": "balcona-bar-api",
      "app.version": "0.1.0",
      "app.environment": "staging",
      "app.nodeEnvironment": "production",
      "app.prefix": "api/v1",
      "app.gitSha": "abc123",
      "app.buildTime": "2026-06-09T08:00:00.000Z",
    };
    const configService = {
      get: jest.fn((key: string) => configValues[key]),
    };
    const migration = {
      status: "ready" as const,
      expected: 42,
      applied: 42,
      pending: 0,
      failed: 0,
      checkedAt: "2026-08-30T10:00:00.000Z",
    };
    const deploymentReadiness = {
      snapshot: jest.fn().mockResolvedValue({
        gitSha: "abc123",
        buildTime: "2026-06-09T08:00:00.000Z",
        migration,
      }),
    };
    const controller = new SystemController(
      configService as never,
      deploymentReadiness as never,
    );

    const result = await controller.info();

    expect(result).toEqual({
      name: "balcona-bar-api",
      version: "0.1.0",
      environment: "staging",
      appEnvironment: "staging",
      nodeEnvironment: "production",
      apiPrefix: "api/v1",
      gitSha: "abc123",
      buildTime: "2026-06-09T08:00:00.000Z",
      migration,
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(result)).not.toContain("DATABASE_URL");
    expect(JSON.stringify(result)).not.toContain("REDIS_URL");
  });
});
