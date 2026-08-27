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
    expect(config.app.nodeEnvironment).toBe("production");
    expect(config.onlinePayments.provider).toBe("mock");
    expect(config.onlinePayments.mockEnabled).toBe(true);
  });

  it("allows true production to start with online payments explicitly disabled", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "false",
      ONLINE_PAYMENT_PROVIDER: "mock",
      MOCK_ONLINE_PAYMENTS_ENABLED: "false",
    });

    expect(() => validateEnvironment(process.env)).not.toThrow();
  });

  it("rejects a true production runtime configured with the mock payment provider", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENT_PROVIDER: "mock",
      MOCK_ONLINE_PAYMENTS_ENABLED: "false",
    });

    expect(() => validateEnvironment(process.env)).toThrow(
      "ONLINE_PAYMENT_PROVIDER=mock is forbidden when APP_ENV=production",
    );
  });

  it("rejects enabling mock payment actions in true production", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENT_PROVIDER: "paymob",
      MOCK_ONLINE_PAYMENTS_ENABLED: "true",
    });

    expect(() => validateEnvironment(process.env)).toThrow(
      "MOCK_ONLINE_PAYMENTS_ENABLED=true is forbidden when APP_ENV=production",
    );
  });

  it("requires PAYMOB_API_KEY when Paymob scheduled reconciliation is enabled", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENT_PROVIDER: "paymob",
      ONLINE_PAYMENT_RECONCILIATION_ENABLED: "true",
      PAYMOB_API_KEY: "",
    });

    expect(() => validateEnvironment(process.env)).toThrow(
      "PAYMOB_API_KEY is required when Paymob reconciliation is enabled",
    );
  });

  it("accepts Paymob reconciliation when the server API key is configured", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENT_PROVIDER: "paymob",
      ONLINE_PAYMENT_RECONCILIATION_ENABLED: "true",
      PAYMOB_API_KEY: "server-api-key",
    });

    expect(() => validateEnvironment(process.env)).not.toThrow();

    const config = configuration();

    expect(config.onlinePayments.paymob.apiKey).toBe("server-api-key");
    expect(config.onlinePayments.reconciliation.enabled).toBe(true);
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
