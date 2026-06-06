import "reflect-metadata";
import configuration from "./configuration";
import { validateEnvironment } from "./env.validation";

const originalEnv = process.env;

function withEnv(env: NodeJS.ProcessEnv) {
  process.env = {
    ...originalEnv,
    ...env,
  };
}

describe("API runtime configuration", () => {
  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("supports a production Node runtime with staging app policy", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      REDIS_URL: "rediss://default:password@example.upstash.io:6379",
      ONLINE_PAYMENT_PROVIDER: "mock",
      MOCK_ONLINE_PAYMENTS_ENABLED: "true",
    });

    expect(() => validateEnvironment(process.env)).not.toThrow();

    const config = configuration();

    expect(config.app.environment).toBe("staging");
    expect(config.onlinePayments.provider).toBe("mock");
    expect(config.onlinePayments.mockEnabled).toBe(true);
  });

  it("keeps mock payment actions disabled for true production by default", () => {
    withEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENT_PROVIDER: "mock",
      MOCK_ONLINE_PAYMENTS_ENABLED: "true",
    });

    const config = configuration();

    expect(config.app.environment).toBe("production");
    expect(config.onlinePayments.mockEnabled).toBe(false);
  });
});
