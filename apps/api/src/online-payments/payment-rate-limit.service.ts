import { HttpStatus, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.constants";
import { PaymentRateLimitPolicy } from "./payment-rate-limit.decorator";

type LocalBucket = {
  count: number;
  expiresAt: number;
};

export type PaymentRateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

const LOCAL_BUCKET_LIMIT = 5_000;

const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then
  redis.call("EXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("TTL", KEYS[1])
return {current, ttl}
`;

@Injectable()
export class PaymentRateLimitService {
  private readonly localBuckets = new Map<string, LocalBucket>();

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async consume(
    policy: PaymentRateLimitPolicy,
    identityId: string,
    sessionId: string,
  ): Promise<PaymentRateLimitResult> {
    const { limit, windowSeconds } = this.policyConfig(policy);
    const key = [
      "balcona",
      "payments",
      "rate-limit",
      policy,
      identityId,
      sessionId,
    ].join(":");

    try {
      const raw = (await this.redis.eval(
        RATE_LIMIT_SCRIPT,
        1,
        key,
        String(windowSeconds),
      )) as [number | string, number | string];
      const count = Number(raw?.[0] ?? 0);
      const ttl = Number(raw?.[1] ?? windowSeconds);

      if (!Number.isFinite(count) || count < 1) {
        throw new Error("Invalid Redis rate limit count");
      }

      return this.result(count, limit, ttl > 0 ? ttl : windowSeconds);
    } catch {
      if (this.isProduction()) {
        throw new ServiceUnavailableException({
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          code: "payment_rate_limit_unavailable",
          message:
            "Online payment protection is temporarily unavailable. Try again shortly.",
        });
      }

      return this.consumeLocal(key, limit, windowSeconds);
    }
  }

  private policyConfig(policy: PaymentRateLimitPolicy) {
    const windowSeconds = this.configService.get<number>(
      "onlinePayments.rateLimit.windowSeconds",
      60,
    );

    if (policy === "customer_create") {
      return {
        limit: this.configService.get<number>(
          "onlinePayments.rateLimit.customerCreateMax",
          6,
        ),
        windowSeconds,
      };
    }

    if (policy === "staff_recover") {
      return {
        limit: this.configService.get<number>(
          "onlinePayments.rateLimit.staffRecoveryMax",
          10,
        ),
        windowSeconds,
      };
    }

    if (policy === "staff_operation") {
      return {
        limit: this.configService.get<number>(
          "onlinePayments.rateLimit.staffOperationMax",
          5,
        ),
        windowSeconds,
      };
    }

    return {
      limit: this.configService.get<number>(
        "onlinePayments.rateLimit.customerReadMax",
        60,
      ),
      windowSeconds,
    };
  }

  private consumeLocal(
    key: string,
    limit: number,
    windowSeconds: number,
  ): PaymentRateLimitResult {
    const now = Date.now();
    this.pruneLocalBuckets(now);
    const current = this.localBuckets.get(key);

    if (!current || current.expiresAt <= now) {
      const expiresAt = now + windowSeconds * 1000;
      this.localBuckets.set(key, { count: 1, expiresAt });

      return this.result(1, limit, windowSeconds);
    }

    current.count += 1;

    return this.result(
      current.count,
      limit,
      Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
    );
  }

  private pruneLocalBuckets(now: number) {
    for (const [key, bucket] of this.localBuckets) {
      if (bucket.expiresAt <= now) {
        this.localBuckets.delete(key);
      }
    }

    while (this.localBuckets.size >= LOCAL_BUCKET_LIMIT) {
      const oldestKey = this.localBuckets.keys().next().value as
        | string
        | undefined;

      if (!oldestKey) {
        break;
      }

      this.localBuckets.delete(oldestKey);
    }
  }

  private result(
    count: number,
    limit: number,
    retryAfterSeconds: number,
  ): PaymentRateLimitResult {
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterSeconds)),
    };
  }

  private isProduction() {
    return this.configService.get<string>("app.environment") === "production";
  }
}
