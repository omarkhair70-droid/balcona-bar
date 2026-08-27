function appEnvironment() {
  return process.env.APP_ENV ?? process.env.NODE_ENV ?? "development";
}

export default () => ({
  app: {
    environment: appEnvironment(),
    nodeEnvironment: process.env.NODE_ENV ?? "development",
    name: process.env.APP_NAME ?? "balcona-bar-api",
    port: Number.parseInt(process.env.PORT ?? "3000", 10),
    prefix: process.env.API_PREFIX ?? "api/v1",
    version: process.env.APP_VERSION ?? "0.1.0",
    gitSha:
      process.env.GIT_SHA ??
      process.env.RAILWAY_GIT_COMMIT_SHA ??
      process.env.VERCEL_GIT_COMMIT_SHA ??
      process.env.SOURCE_VERSION ??
      "local",
    buildTime: process.env.BUILD_TIME ?? process.env.APP_BUILD_TIME,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number.parseInt(process.env.REDIS_PORT ?? "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number.parseInt(process.env.REDIS_DB ?? "0", 10),
  },
  staffAuth: {
    sessionHours: Number.parseInt(
      process.env.STAFF_AUTH_SESSION_HOURS ?? "12",
      10,
    ),
    inviteExpiresDays: Number.parseInt(
      process.env.STAFF_INVITE_EXPIRES_DAYS ?? "7",
      10,
    ),
    devBootstrapEnabled:
      process.env.STAFF_AUTH_DEV_BOOTSTRAP_ENABLED === "true",
  },
  platformAuth: {
    sessionHours: Number.parseInt(
      process.env.PLATFORM_AUTH_SESSION_HOURS ?? "12",
      10,
    ),
    devBootstrapEnabled:
      process.env.PLATFORM_ADMIN_DEV_BOOTSTRAP_ENABLED === "true",
    bootstrapEmail:
      process.env.PLATFORM_ADMIN_EMAIL ?? "platform@balcona.local",
    bootstrapPassword:
      process.env.PLATFORM_ADMIN_PASSWORD ?? "change-me-platform-123",
  },
  customerAccess: {
    tokenHours: Number.parseInt(
      process.env.CUSTOMER_ACCESS_TOKEN_HOURS ?? "24",
      10,
    ),
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== "false",
  },
  security: {
    corsOrigins: process.env.CORS_ORIGINS,
  },
  jobs: {
    enabled: process.env.JOBS_ENABLED !== "false",
  },
  aiWaiter: {
    provider: process.env.AI_WAITER_PROVIDER ?? "stub",
    menuSnapshotLimit: Number.parseInt(
      process.env.AI_WAITER_MENU_SNAPSHOT_LIMIT ?? "200",
      10,
    ),
    groq: {
      apiKey: process.env.GROQ_API_KEY || undefined,
      model: process.env.GROQ_MODEL ?? "openai/gpt-oss-20b",
      timeoutMs: Number.parseInt(process.env.GROQ_TIMEOUT_MS ?? "10000", 10),
      maxRetries: Number.parseInt(process.env.GROQ_MAX_RETRIES ?? "1", 10),
      maxContextItems: Number.parseInt(
        process.env.GROQ_MAX_CONTEXT_ITEMS ?? "8",
        10,
      ),
      dryRun: process.env.GROQ_DRY_RUN === "true",
    },
  },
  onlinePayments: {
    enabled: process.env.ONLINE_PAYMENTS_ENABLED !== "false",
    provider: process.env.ONLINE_PAYMENT_PROVIDER ?? "mock",
    mockEnabled:
      process.env.MOCK_ONLINE_PAYMENTS_ENABLED !== "false" &&
      appEnvironment() !== "production",
    checkoutBaseUrl:
      process.env.ONLINE_PAYMENT_CHECKOUT_BASE_URL ?? "http://localhost:3001",
    paymob: {
      baseUrl: process.env.PAYMOB_BASE_URL ?? "https://accept.paymob.com",
      secretKey: process.env.PAYMOB_SECRET_KEY || undefined,
      apiKey: process.env.PAYMOB_API_KEY || undefined,
      publicKey: process.env.PAYMOB_PUBLIC_KEY || undefined,
      hmacSecret: process.env.PAYMOB_HMAC_SECRET || undefined,
      integrationIds: (process.env.PAYMOB_INTEGRATION_IDS ?? "")
        .split(",")
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isInteger(value) && value > 0),
      notificationUrl: process.env.PAYMOB_NOTIFICATION_URL || undefined,
      allowedReturnOrigins: (
        process.env.PAYMOB_ALLOWED_RETURN_ORIGINS ??
        process.env.CORS_ORIGINS ??
        ""
      )
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      timeoutMs: Number.parseInt(process.env.PAYMOB_TIMEOUT_MS ?? "10000", 10),
      expirationSeconds: Number.parseInt(
        process.env.PAYMOB_INTENTION_EXPIRATION_SECONDS ?? "900",
        10,
      ),
      expectedLive: process.env.PAYMOB_EXPECT_LIVE === "true",
    },
    reconciliation: {
      enabled: process.env.ONLINE_PAYMENT_RECONCILIATION_ENABLED === "true",
      intervalSeconds: Number.parseInt(
        process.env.ONLINE_PAYMENT_RECONCILIATION_INTERVAL_SECONDS ?? "60",
        10,
      ),
      staleSeconds: Number.parseInt(
        process.env.ONLINE_PAYMENT_RECONCILIATION_STALE_SECONDS ?? "120",
        10,
      ),
      batchSize: Number.parseInt(
        process.env.ONLINE_PAYMENT_RECONCILIATION_BATCH_SIZE ?? "25",
        10,
      ),
    },
    rateLimit: {
      windowSeconds: Number.parseInt(
        process.env.ONLINE_PAYMENT_RATE_LIMIT_WINDOW_SECONDS ?? "60",
        10,
      ),
      customerCreateMax: Number.parseInt(
        process.env.ONLINE_PAYMENT_CREATE_RATE_LIMIT_MAX ?? "6",
        10,
      ),
      customerReadMax: Number.parseInt(
        process.env.ONLINE_PAYMENT_READ_RATE_LIMIT_MAX ?? "60",
        10,
      ),
    },
  },
  smokeBootstrap: {
    enabled: process.env.SMOKE_BOOTSTRAP_ENABLED === "true",
    token: process.env.SMOKE_BOOTSTRAP_TOKEN || process.env.SMOKE_RESET_TOKEN,
  },
});
