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
import { PaymentReconciliationService } from "./payment-reconciliation.service";

const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = new Map(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return {
    year: values.get("year")!,
    month: values.get("month")!,
    day: values.get("day")!,
    hour: values.get("hour")!,
    minute: values.get("minute")!,
    second: values.get("second")!,
  };
}

function timezoneOffsetMs(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const roundedActual = Math.floor(date.getTime() / 1000) * 1000;

  return representedAsUtc - roundedActual;
}

function zonedMidnightToUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
) {
  const targetWallClockUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidate = targetWallClockUtc;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = timezoneOffsetMs(new Date(candidate), timeZone);
    const next = targetWallClockUtc - offset;

    if (next === candidate) {
      break;
    }

    candidate = next;
  }

  return new Date(candidate);
}

export function previousClosedDayRange(
  now: Date,
  timeZone: string,
) {
  const current = zonedParts(now, timeZone);
  const localCalendarDay = new Date(
    Date.UTC(current.year, current.month - 1, current.day),
  );
  const previousLocalCalendarDay = new Date(
    localCalendarDay.getTime() - 24 * 60 * 60 * 1000,
  );
  const previousYear = previousLocalCalendarDay.getUTCFullYear();
  const previousMonth = previousLocalCalendarDay.getUTCMonth() + 1;
  const previousDay = previousLocalCalendarDay.getUTCDate();
  const start = zonedMidnightToUtc(
    previousYear,
    previousMonth,
    previousDay,
    timeZone,
  );
  const end = zonedMidnightToUtc(
    current.year,
    current.month,
    current.day,
    timeZone,
  );
  const label = [
    String(previousYear).padStart(4, "0"),
    String(previousMonth).padStart(2, "0"),
    String(previousDay).padStart(2, "0"),
  ].join("-");

  return { start, end, label };
}

@Injectable()
export class OnlinePaymentSettlementReconciliationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    OnlinePaymentSettlementReconciliationScheduler.name,
  );
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
    private readonly paymentReconciliationService: PaymentReconciliationService,
  ) {}

  onModuleInit() {
    if (!this.enabled()) {
      return;
    }

    this.timer = setInterval(() => {
      void this.runTick();
    }, this.intervalSeconds() * 1000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async runTick(now = new Date()) {
    const token = randomUUID();
    const lockKey =
      "balcona:payments:paymob-settlement-reconciliation:lock";
    const lockTtlMs = Math.max(this.intervalSeconds() * 2, 900) * 1000;

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
        message: "payments.settlement_reconciliation_lock_unavailable",
        exception: error instanceof Error ? error.name : "UnknownError",
      });
      return;
    }

    try {
      const timeZone = this.timeZone();
      const range = previousClosedDayRange(now, timeZone);
      const maxScopes = this.configService.get<number>(
        "onlinePayments.settlementReconciliation.maxScopesPerTick",
        50,
      );
      const scopes =
        await this.paymentReconciliationService.discoverPaymobReconciliationScopes(
          range.start,
          range.end,
          maxScopes,
        );
      const results: Array<{
        branchId: string;
        currency: string;
        status: string;
      }> = [];

      for (const scope of scopes) {
        try {
          const run =
            await this.paymentReconciliationService.runPaymobProviderReconciliation(
              scope.branchId,
              undefined,
              {
                periodStart: range.start.toISOString(),
                periodEnd: range.end.toISOString(),
                currency: scope.currency,
                idempotencyKey: [
                  "daily-paymob-settlement",
                  range.label,
                  scope.branchId,
                  scope.currency,
                ].join(":"),
              },
            );

          results.push({
            branchId: scope.branchId,
            currency: scope.currency,
            status: run.status,
          });
        } catch (error) {
          results.push({
            branchId: scope.branchId,
            currency: scope.currency,
            status: "failed",
          });
          this.logger.warn({
            message: "payments.settlement_reconciliation_scope_failed",
            branchId: scope.branchId,
            currency: scope.currency,
            exception: error instanceof Error ? error.name : "UnknownError",
          });
        }
      }

      this.logger.log({
        message: "payments.settlement_reconciliation_completed",
        timeZone,
        periodStart: range.start.toISOString(),
        periodEnd: range.end.toISOString(),
        scopeCount: scopes.length,
        results,
      });
    } catch (error) {
      this.logger.warn({
        message: "payments.settlement_reconciliation_failed",
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
        // The lock has a TTL; failed release cannot leave it permanent.
      }
    }
  }

  private enabled() {
    return (
      this.configService.get<boolean>(
        "onlinePayments.settlementReconciliation.enabled",
        false,
      ) === true
    );
  }

  private intervalSeconds() {
    return this.configService.get<number>(
      "onlinePayments.settlementReconciliation.intervalSeconds",
      3600,
    );
  }

  private timeZone() {
    return this.configService.get<string>(
      "onlinePayments.settlementReconciliation.timezone",
      "Africa/Cairo",
    );
  }
}
