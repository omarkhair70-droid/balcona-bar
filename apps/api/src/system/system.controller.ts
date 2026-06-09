import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Controller("system")
export class SystemController {
  constructor(private readonly configService: ConfigService) {}

  @Get("info")
  info() {
    const appEnvironment = this.configService.get<string>("app.environment");

    return {
      name: this.configService.get<string>("app.name"),
      version: this.configService.get<string>("app.version"),
      environment: appEnvironment,
      appEnvironment,
      nodeEnvironment: this.configService.get<string>("app.nodeEnvironment"),
      apiPrefix: this.configService.get<string>("app.prefix"),
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
