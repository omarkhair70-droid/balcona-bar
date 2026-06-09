import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Controller("health")
export class HealthController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  check() {
    return {
      status: "ok",
      service: this.configService.get<string>("app.name"),
      version: this.configService.get<string>("app.version"),
      environment: this.configService.get<string>("app.environment"),
      gitSha: this.configService.get<string>("app.gitSha"),
      buildTime:
        this.configService.get<string>("app.buildTime") ?? "not_provided",
      migration: {
        status: "not_checked",
        check: "pnpm --filter @balcona-bar/api prisma:migrate:deploy",
      },
      timestamp: new Date().toISOString(),
    };
  }
}
