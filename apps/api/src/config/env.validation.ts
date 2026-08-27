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
  PAYMOB_BASE_URL?: string;

  @IsString()
  @IsOptional()
  PAYMOB_SECRET_KEY?: string;

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

  return validatedConfig;
}
