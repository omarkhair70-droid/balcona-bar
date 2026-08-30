import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeploymentReadinessService } from "../deployment/deployment-readiness.service";

@Controller("system")
export class SystemController {
  constructor(
    private readonly configService: ConfigService,
    private readonly deploymentReadiness: DeploymentReadinessService,
  ) {}

  @Get("info")
  async info() {
    const appEnvironment = this.configService.get<string>("app.environment");
    const deployment = await this.deploymentReadiness.snapshot();

    return {
      name: this.configService.get<string>("app.name"),
      version: this.configService.get<string>("app.version"),
      environment: appEnvironment,
      appEnvironment,
      nodeEnvironment: this.configService.get<string>("app.nodeEnvironment"),
      apiPrefix: this.configService.get<string>("app.prefix"),
      gitSha: deployment.gitSha,
      buildTime: deployment.buildTime,
      migration: deployment.migration,
      timestamp: new Date().toISOString(),
    };
  }
}
