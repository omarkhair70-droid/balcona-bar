export default () => ({
  app: {
    environment: process.env.NODE_ENV ?? 'development',
    name: process.env.APP_NAME ?? 'balcona-bar-api',
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    prefix: process.env.API_PREFIX ?? 'api/v1',
    version: process.env.APP_VERSION ?? '0.1.0',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number.parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number.parseInt(process.env.REDIS_DB ?? '0', 10),
  },
  staffAuth: {
    sessionHours: Number.parseInt(process.env.STAFF_AUTH_SESSION_HOURS ?? '12', 10),
    devBootstrapEnabled:
      process.env.STAFF_AUTH_DEV_BOOTSTRAP_ENABLED === 'true',
  },
  customerAccess: {
    tokenHours: Number.parseInt(
      process.env.CUSTOMER_ACCESS_TOKEN_HOURS ?? '24',
      10,
    ),
  },
  swagger: {
    enabled: process.env.SWAGGER_ENABLED !== 'false',
  },
  security: {
    corsOrigins: process.env.CORS_ORIGINS,
  },
  jobs: {
    enabled: process.env.JOBS_ENABLED !== 'false',
  },
});
