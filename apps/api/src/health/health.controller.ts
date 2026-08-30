import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeploymentReadinessService } from "../deployment/deployment-readiness.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly deploymentReadiness: DeploymentReadinessService,
  ) {}

  @Get()
  async check() {
    const deployment = await this.deploymentReadiness.snapshot();

    return {
      status: "ok",
      service: this.configService.get<string>("app.name"),
      version: this.configService.get<string>("app.version"),
      environment: this.configService.get<string>("app.environment"),
      gitSha: deployment.gitSha,
      buildTime: deployment.buildTime,
      migration: deployment.migration,
      timestamp: new Date().toISOString(),
    };
  }
}
