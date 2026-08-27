import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "crypto";
import Redis from "ioredis";
import { REDIS_CLIENT } from "../redis/redis.constants";
import { OnlinePaymentsService } from "./online-payments.service";

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

@Injectable()
export class OnlinePaymentReconciliationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    OnlinePaymentReconciliationScheduler.name,
  );
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly onlinePaymentsService: OnlinePaymentsService,
  ) {}

  onModuleInit() {
    if (!this.enabled()) {
      return;
    }

    const intervalMs = this.intervalSeconds() * 1000;
    this.timer = setInterval(() => {
      void this.runTick();
    }, intervalMs);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async runTick() {
    const token = randomUUID();
    const lockKey = "balcona:payments:paymob-reconciliation:lock";
    const lockTtlMs = Math.max(this.intervalSeconds() * 2, 60) * 1000;

    try {
      const acquired = await this.redis.set(
        lockKey,
        token,
        "PX",
        lockTtlMs,
        "NX",
      );

      if (acquired !== "OK") {
        return;
      }
    } catch (error) {
      this.logger.warn({
        message: "payments.reconciliation_lock_unavailable",
        exception: error instanceof Error ? error.name : "UnknownError",
      });
      return;
    }

    try {
      const [intents, operations] = await Promise.all([
        this.onlinePaymentsService.reconcilePendingPaymobIntents(),
        this.onlinePaymentsService.reconcilePendingPaymobOperations(),
      ]);
      this.logger.log({
        message: "payments.reconciliation_completed",
        intents,
        operations,
      });
    } catch (error) {
      this.logger.warn({
        message: "payments.reconciliation_failed",
        exception: error instanceof Error ? error.name : "UnknownError",
      });
    } finally {
      try {
        await this.redis.eval(
          RELEASE_LOCK_SCRIPT,
          1,
          lockKey,
          token,
        );
      } catch {
        // The lock has a TTL; a failed release does not leave it permanent.
      }
    }
  }

  private enabled() {
    return (
      this.configService.get<boolean>(
        "onlinePayments.reconciliation.enabled",
        false,
      ) === true
    );
  }

  private intervalSeconds() {
    return this.configService.get<number>(
      "onlinePayments.reconciliation.intervalSeconds",
      60,
    );
  }
}
