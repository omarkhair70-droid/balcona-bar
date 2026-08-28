import { plainToInstance } from "class-transformer";
import {
  IsBooleanString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  validateSync,
} from "class-validator";

enum NodeEnvironment {
  Development = "development",
  Test = "test",
  Production = "production",
}

enum AppEnvironment {
  Development = "development",
  Test = "test",
  Staging = "staging",
  Production = "production",
}

enum AiWaiterProvider {
  Stub = "stub",
  Groq = "groq",
}

enum OnlinePaymentProvider {
  Mock = "mock",
  Paymob = "paymob",
  Fawry = "fawry",
  External = "external",
}

class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  @IsOptional()
  NODE_ENV?: NodeEnvironment;

  @IsEnum(AppEnvironment)
  @IsOptional()
  APP_ENV?: AppEnvironment;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  PORT?: number;

  @IsString()
  @IsOptional()
  API_PREFIX?: string;

  @IsString()
  @IsOptional()
  APP_NAME?: string;

  @IsString()
  @IsOptional()
  APP_VERSION?: string;

  @IsString()
  @IsOptional()
  GIT_SHA?: string;

  @IsString()
  @IsOptional()
  RAILWAY_GIT_COMMIT_SHA?: string;

  @IsString()
  @IsOptional()
  VERCEL_GIT_COMMIT_SHA?: string;

  @IsString()
  @IsOptional()
  SOURCE_VERSION?: string;

  @IsString()
  @IsOptional()
  BUILD_TIME?: string;

  @IsString()
  @IsOptional()
  APP_BUILD_TIME?: string;

  @IsString()
  DATABASE_URL!: string;

  @Matches(/^rediss?:\/\//)
  @IsOptional()
  REDIS_URL?: string;

  @IsString()
  @IsOptional()
  REDIS_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  REDIS_PORT?: number;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  REDIS_DB?: number;

  @IsInt()
  @Min(1)
  @Max(168)
  @IsOptional()
  STAFF_AUTH_SESSION_HOURS?: number;

  @IsInt()
  @Min(1)
  @Max(90)
  @IsOptional()
  STAFF_INVITE_EXPIRES_DAYS?: number;

  @IsBooleanString()
  @IsOptional()
  STAFF_AUTH_DEV_BOOTSTRAP_ENABLED?: string;

  @IsInt()
  @Min(1)
  @Max(168)
  @IsOptional()
  PLATFORM_AUTH_SESSION_HOURS?: number;

  @IsBooleanString()
  @IsOptional()
  PLATFORM_ADMIN_DEV_BOOTSTRAP_ENABLED?: string;

  @IsEmail()
  @IsOptional()
  PLATFORM_ADMIN_EMAIL?: string;

  @IsString()
  @IsOptional()
  PLATFORM_ADMIN_PASSWORD?: string;

  @IsInt()
  @Min(1)
  @Max(168)
  @IsOptional()
  CUSTOMER_ACCESS_TOKEN_HOURS?: number;

  @IsBooleanString()
  @IsOptional()
  SWAGGER_ENABLED?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGINS?: string;

  @IsBooleanString()
  @IsOptional()
  JOBS_ENABLED?: string;

  @IsEnum(AiWaiterProvider)
  @IsOptional()
  AI_WAITER_PROVIDER?: AiWaiterProvider;

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  AI_WAITER_MENU_SNAPSHOT_LIMIT?: number;

  @IsString()
  @IsOptional()
  GROQ_API_KEY?: string;

  @IsString()
  @IsOptional()
  GROQ_MODEL?: string;

  @IsInt()
  @Min(1000)
  @Max(60000)
  @IsOptional()
  GROQ_TIMEOUT_MS?: number;

  @IsInt()
  @Min(0)
  @Max(3)
  @IsOptional()
  GROQ_MAX_RETRIES?: number;

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  GROQ_MAX_CONTEXT_ITEMS?: number;

  @IsBooleanString()
  @IsOptional()
  GROQ_DRY_RUN?: string;

  @IsBooleanString()
  @IsOptional()
  ONLINE_PAYMENTS_ENABLED?: string;

  @IsEnum(OnlinePaymentProvider)
  @IsOptional()
  ONLINE_PAYMENT_PROVIDER?: OnlinePaymentProvider;

  @IsBooleanString()
  @IsOptional()
  MOCK_ONLINE_PAYMENTS_ENABLED?: string;

  @IsString()
  @IsOptional()
  ONLINE_PAYMENT_CHECKOUT_BASE_URL?: string;

  @IsString()
  @IsOptional()
  FAWRY_CHECKOUT_URL?: string;

  @IsString()
  @IsOptional()
  FAWRY_STATUS_URL?: string;

  @IsString()
  @IsOptional()
  FAWRY_REFUND_URL?: string;

  @IsString()
  @IsOptional()
  FAWRY_CANCEL_URL?: string;

  @IsString()
  @IsOptional()
  FAWRY_MERCHANT_CODE?: string;

  @IsString()
  @IsOptional()
  FAWRY_SECURE_KEY?: string;

  @IsString()
  @IsOptional()
  FAWRY_NOTIFICATION_URL?: string;

  @IsString()
  @IsOptional()
  FAWRY_RETURN_URL?: string;

  @IsString()
  @IsOptional()
  FAWRY_ALLOWED_RETURN_ORIGINS?: string;

  @IsInt()
  @Min(1000)
  @Max(60000)
  @IsOptional()
  FAWRY_TIMEOUT_MS?: number;

  @IsInt()
  @Min(60)
  @Max(86400)
  @IsOptional()
  FAWRY_CHECKOUT_EXPIRATION_SECONDS?: number;

  @IsBooleanString()
  @IsOptional()
  FAWRY_EXPECT_LIVE?: string;

  @IsString()
  @IsOptional()
  PAYMOB_BASE_URL?: string;

  @IsString()
  @IsOptional()
  PAYMOB_SECRET_KEY?: string;

  @IsString()
  @IsOptional()
  PAYMOB_API_KEY?: string;

  @IsString()
  @IsOptional()
  PAYMOB_PUBLIC_KEY?: string;

  @IsString()
  @IsOptional()
  PAYMOB_HMAC_SECRET?: string;

  @IsString()
  @IsOptional()
  PAYMOB_INTEGRATION_IDS?: string;

  @IsString()
  @IsOptional()
  PAYMOB_NOTIFICATION_URL?: string;

  @IsString()
  @IsOptional()
  PAYMOB_ALLOWED_RETURN_ORIGINS?: string;

  @IsInt()
  @Min(1000)
  @Max(60000)
  @IsOptional()
  PAYMOB_TIMEOUT_MS?: number;

  @IsInt()
  @Min(60)
  @Max(3110400)
  @IsOptional()
  PAYMOB_INTENTION_EXPIRATION_SECONDS?: number;

  @IsBooleanString()
  @IsOptional()
  PAYMOB_EXPECT_LIVE?: string;

  @IsBooleanString()
  @IsOptional()
  ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_ENABLED?: string;

  @IsInt()
  @Min(300)
  @Max(86400)
  @IsOptional()
  ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_INTERVAL_SECONDS?: number;

  @IsString()
  @IsOptional()
  ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_TIMEZONE?: string;

  @IsInt()
  @Min(1)
  @Max(5000)
  @IsOptional()
  ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_MAX_ENTRIES?: number;

  @IsInt()
  @Min(1)
  @Max(500)
  @IsOptional()
  ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_MAX_SCOPES?: number;

  @IsBooleanString()
  @IsOptional()
  ONLINE_PAYMENT_RECONCILIATION_ENABLED?: string;

  @IsInt()
  @Min(30)
  @Max(3600)
  @IsOptional()
  ONLINE_PAYMENT_RECONCILIATION_INTERVAL_SECONDS?: number;

  @IsInt()
  @Min(30)
  @Max(86400)
  @IsOptional()
  ONLINE_PAYMENT_RECONCILIATION_STALE_SECONDS?: number;

  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  ONLINE_PAYMENT_RECONCILIATION_BATCH_SIZE?: number;

  @IsInt()
  @Min(10)
  @Max(3600)
  @IsOptional()
  ONLINE_PAYMENT_RATE_LIMIT_WINDOW_SECONDS?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  ONLINE_PAYMENT_CREATE_RATE_LIMIT_MAX?: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  @IsOptional()
  ONLINE_PAYMENT_READ_RATE_LIMIT_MAX?: number;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  ONLINE_PAYMENT_STAFF_RECOVERY_RATE_LIMIT_MAX?: number;

  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  ONLINE_PAYMENT_STAFF_OPERATION_RATE_LIMIT_MAX?: number;

  @IsBooleanString()
  @IsOptional()
  SMOKE_BOOTSTRAP_ENABLED?: string;

  @IsString()
  @IsOptional()
  SMOKE_BOOTSTRAP_TOKEN?: string;

  @IsString()
  @IsOptional()
  SMOKE_RESET_TOKEN?: string;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  const effectiveAppEnvironment = String(
    validatedConfig.APP_ENV ??
      validatedConfig.NODE_ENV ??
      AppEnvironment.Development,
  );
  const effectivePaymentProvider =
    validatedConfig.ONLINE_PAYMENT_PROVIDER ?? OnlinePaymentProvider.Mock;
  const onlinePaymentsEnabled =
    validatedConfig.ONLINE_PAYMENTS_ENABLED !== "false";

  if (
    effectiveAppEnvironment === "production" &&
    onlinePaymentsEnabled &&
    effectivePaymentProvider === OnlinePaymentProvider.Mock
  ) {
    throw new Error(
      "ONLINE_PAYMENT_PROVIDER=mock is forbidden when APP_ENV=production",
    );
  }

  if (
    effectiveAppEnvironment === "production" &&
    validatedConfig.MOCK_ONLINE_PAYMENTS_ENABLED === "true"
  ) {
    throw new Error(
      "MOCK_ONLINE_PAYMENTS_ENABLED=true is forbidden when APP_ENV=production",
    );
  }

  if (
    effectiveAppEnvironment === "production" &&
    onlinePaymentsEnabled &&
    effectivePaymentProvider === OnlinePaymentProvider.Fawry
  ) {
    if (
      !validatedConfig.FAWRY_MERCHANT_CODE ||
      !validatedConfig.FAWRY_SECURE_KEY ||
      !validatedConfig.FAWRY_CHECKOUT_URL ||
      !validatedConfig.FAWRY_STATUS_URL ||
      !validatedConfig.FAWRY_REFUND_URL ||
      !validatedConfig.FAWRY_NOTIFICATION_URL ||
      !validatedConfig.FAWRY_RETURN_URL
    ) {
      throw new Error(
        "Fawry production payments require merchant code, secure key, checkout/status/refund URLs, notification URL, and return URL",
      );
    }

    if (validatedConfig.FAWRY_EXPECT_LIVE !== "true") {
      throw new Error(
        "FAWRY_EXPECT_LIVE=true is required for production Fawry payments",
      );
    }
  }

  if (
    effectiveAppEnvironment === "production" &&
    onlinePaymentsEnabled &&
    effectivePaymentProvider === OnlinePaymentProvider.Paymob &&
    !validatedConfig.PAYMOB_API_KEY
  ) {
    throw new Error(
      "PAYMOB_API_KEY is required for production Paymob recovery",
    );
  }

  if (
    validatedConfig.ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_ENABLED === "true"
  ) {
    if (!onlinePaymentsEnabled) {
      throw new Error(
        "Settlement reconciliation requires ONLINE_PAYMENTS_ENABLED=true",
      );
    }

    if (effectivePaymentProvider !== OnlinePaymentProvider.Paymob) {
      throw new Error(
        "Settlement reconciliation currently requires ONLINE_PAYMENT_PROVIDER=paymob",
      );
    }

    if (!validatedConfig.PAYMOB_API_KEY) {
      throw new Error(
        "PAYMOB_API_KEY is required when settlement reconciliation is enabled",
      );
    }

    const timezone =
      validatedConfig.ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_TIMEZONE ??
      "Africa/Cairo";

    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
    } catch {
      throw new Error(
        "ONLINE_PAYMENT_SETTLEMENT_RECONCILIATION_TIMEZONE is invalid",
      );
    }
  }

  if (validatedConfig.ONLINE_PAYMENT_RECONCILIATION_ENABLED === "true") {
    if (!onlinePaymentsEnabled) {
      throw new Error(
        "Online payment reconciliation requires ONLINE_PAYMENTS_ENABLED=true",
      );
    }

    if (
      effectivePaymentProvider !== OnlinePaymentProvider.Paymob &&
      effectivePaymentProvider !== OnlinePaymentProvider.Fawry
    ) {
      throw new Error(
        "Online payment reconciliation currently requires ONLINE_PAYMENT_PROVIDER=paymob or fawry",
      );
    }

    if (
      effectivePaymentProvider === OnlinePaymentProvider.Paymob &&
      !validatedConfig.PAYMOB_API_KEY
    ) {
      throw new Error(
        "PAYMOB_API_KEY is required when Paymob reconciliation is enabled",
      );
    }

    if (
      effectivePaymentProvider === OnlinePaymentProvider.Fawry &&
      (
        !validatedConfig.FAWRY_MERCHANT_CODE ||
        !validatedConfig.FAWRY_SECURE_KEY ||
        !validatedConfig.FAWRY_STATUS_URL
      )
    ) {
      throw new Error(
        "Fawry merchant code, secure key, and status URL are required when Fawry reconciliation is enabled",
      );
    }
  }

  return validatedConfig;
}
