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
});
