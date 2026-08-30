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

  it("rejects production Paymob when the inquiry recovery API key is missing", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "true",
      ONLINE_PAYMENT_PROVIDER: "paymob",
      MOCK_ONLINE_PAYMENTS_ENABLED: "false",
      PAYMOB_API_KEY: "",
    });

    expect(() => validateEnvironment(process.env)).toThrow(
      "PAYMOB_API_KEY is required for production Paymob recovery",
    );
  });

  it("requires PAYMOB_API_KEY when PAY-6 settlement reconciliation is enabled", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "true",
      ONLINE_PAYMENT_PROVIDER: "paymob",
      ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_ENABLED: "true",
      PAYMOB_API_KEY: "",
    });

    expect(() => validateEnvironment(process.env)).toThrow(
      "PAYMOB_API_KEY is required when settlement reconciliation is enabled",
    );
  });

  it("rejects an invalid PAY-6 reconciliation timezone", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "true",
      ONLINE_PAYMENT_PROVIDER: "paymob",
      ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_ENABLED: "true",
      ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_TIMEZONE: "Mars/Olympus",
      PAYMOB_API_KEY: "server-api-key",
    });

    expect(() => validateEnvironment(process.env)).toThrow(
      "ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_TIMEZONE is invalid",
    );
  });

  it("accepts PAY-6 settlement reconciliation with explicit Cairo runtime limits", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "true",
      ONLINE_PAYMENT_PROVIDER: "paymob",
      ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_ENABLED: "true",
      ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_INTERVAL_SECONDS: "3600",
      ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_TIMEZONE: "Africa/Cairo",
      ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_MAX_ENTRIES: "400",
      ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_MAX_SCOPES: "40",
      PAYMOB_API_KEY: "server-api-key",
    });

    expect(() => validateEnvironment(process.env)).not.toThrow();

    const config = configuration();

    expect(config.onlinePayments.settlementReconciliation).toMatchObject({
      enabled: true,
      intervalSeconds: 3600,
      timezone: "Africa/Cairo",
      maxEntriesPerRun: 400,
      maxScopesPerTick: 40,
    });
  });

  it("accepts the fail-closed Maestr provider slot in staging", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "true",
      ONLINE_PAYMENT_PROVIDER: "maestr",
      MAESTR_API_URL: "https://sandbox.example.maestr.invalid",
      MAESTR_API_KEY: "server-api-key",
      MAESTR_TIMEOUT_MS: "9000",
    });

    expect(() => validateEnvironment(process.env)).not.toThrow();

    const config = configuration();

    expect(config.onlinePayments.provider).toBe("maestr");
    expect(config.onlinePayments.maestr).toEqual({
      apiUrl: "https://sandbox.example.maestr.invalid",
      apiKey: "server-api-key",
      timeoutMs: 9000,
    });
  });

  it("rejects Maestr as a production provider until the merchant API contract is complete", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "true",
      ONLINE_PAYMENT_PROVIDER: "maestr",
      MAESTR_API_URL: "https://api.example.maestr.invalid",
      MAESTR_API_KEY: "live-server-key",
    });

    expect(() => validateEnvironment(process.env)).toThrow(
      "Maestr production payments are disabled until the PAY-8 merchant API contract is complete",
    );
  });

  it("accepts Fawry staging runtime with hosted checkout credentials", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "true",
      ONLINE_PAYMENT_PROVIDER: "fawry",
      FAWRY_MERCHANT_CODE: "merchant-code",
      FAWRY_SECURE_KEY: "secure-key",
      FAWRY_NOTIFICATION_URL:
        "https://api.example.com/api/v1/online-payments/webhooks/fawry",
      FAWRY_RETURN_URL: "https://app.example.com/payment/return",
      FAWRY_ALLOWED_RETURN_ORIGINS: "https://app.example.com",
    });

    expect(() => validateEnvironment(process.env)).not.toThrow();

    const config = configuration();

    expect(config.onlinePayments.fawry).toMatchObject({
      merchantCode: "merchant-code",
      secureKey: "secure-key",
      notificationUrl:
        "https://api.example.com/api/v1/online-payments/webhooks/fawry",
      returnUrl: "https://app.example.com/payment/return",
      expectedLive: false,
    });
  });

  it("rejects production Fawry when live provider configuration is incomplete", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "true",
      ONLINE_PAYMENT_PROVIDER: "fawry",
      FAWRY_MERCHANT_CODE: "merchant-code",
      FAWRY_SECURE_KEY: "secure-key",
      FAWRY_NOTIFICATION_URL:
        "https://api.example.com/api/v1/online-payments/webhooks/fawry",
      FAWRY_RETURN_URL: "https://app.example.com/payment/return",
      FAWRY_EXPECT_LIVE: "false",
    });

    expect(() => validateEnvironment(process.env)).toThrow(
      "Fawry production payments require merchant code, secure key, checkout/status/refund URLs, notification URL, and return URL",
    );
  });

  it("rejects production Fawry when staging mode is still expected", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "true",
      ONLINE_PAYMENT_PROVIDER: "fawry",
      FAWRY_CHECKOUT_URL: "https://www.atfawry.com/live-checkout",
      FAWRY_STATUS_URL:
        "https://www.atfawry.com/ECommerceWeb/Fawry/payments/status/v2",
      FAWRY_REFUND_URL:
        "https://www.atfawry.com/ECommerceWeb/Fawry/payments/refund",
      FAWRY_MERCHANT_CODE: "merchant-code",
      FAWRY_SECURE_KEY: "secure-key",
      FAWRY_NOTIFICATION_URL:
        "https://api.example.com/api/v1/online-payments/webhooks/fawry",
      FAWRY_RETURN_URL: "https://app.example.com/payment/return",
      FAWRY_EXPECT_LIVE: "false",
    });

    expect(() => validateEnvironment(process.env)).toThrow(
      "FAWRY_EXPECT_LIVE=true is required for production Fawry payments",
    );
  });

  it("allows Fawry pull-based reconciliation with signed status credentials", () => {
    withEnv({
      NODE_ENV: "production",
      APP_ENV: "staging",
      DATABASE_URL: "postgresql://user:password@localhost:5432/balcona",
      ONLINE_PAYMENTS_ENABLED: "true",
      ONLINE_PAYMENT_PROVIDER: "fawry",
      ONLINE_PAYMENT_RECONCILIATION_ENABLED: "true",
      FAWRY_MERCHANT_CODE: "merchant-code",
      FAWRY_SECURE_KEY: "secure-key",
      FAWRY_STATUS_URL:
        "https://atfawry.fawrystaging.com/ECommerceWeb/Fawry/payments/status/v2",
      FAWRY_NOTIFICATION_URL:
        "https://api.example.com/api/v1/online-payments/webhooks/fawry",
      FAWRY_RETURN_URL: "https://app.example.com/payment/return",
    });

    expect(() => validateEnvironment(process.env)).not.toThrow();
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
