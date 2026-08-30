import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.constants";

const RATE_LIMIT_SCRIPT = `
local current = redis.call("INCR", KEYS[1])
if current == 1 then redis.call("EXPIRE", KEYS[1], ARGV[1]) end
return {current, redis.call("TTL", KEYS[1])}
`;

@Injectable()
export class DemoRequestRateLimitService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {}

  async assertAllowed(identity: string) {
    const windowSeconds = this.configService.get<number>(
      "demoRequests.rateLimitWindowSeconds",
      900,
    );
    const limit = this.configService.get<number>(
      "demoRequests.rateLimitMax",
      5,
    );
    const identityHash = createHash("sha256")
      .update(identity)
      .digest("hex")
      .slice(0, 32);

    try {
      const [rawCount, rawTtl] = (await this.redis.eval(
        RATE_LIMIT_SCRIPT,
        1,
        `balcona:demo-requests:${identityHash}`,
        String(windowSeconds),
      )) as [number | string, number | string];
      const count = Number(rawCount);
      const retryAfter = Math.max(1, Number(rawTtl) || windowSeconds);

      if (count > limit) {
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            code: "demo_request_rate_limit_exceeded",
            message: "Too many demo requests. Try again later.",
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (
        this.configService.get<string>("app.environment") === "production"
      ) {
        throw new ServiceUnavailableException({
          code: "demo_request_protection_unavailable",
          message: "Demo requests are temporarily unavailable. Try again later.",
        });
      }
    }
  }
}
