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
  },
});
